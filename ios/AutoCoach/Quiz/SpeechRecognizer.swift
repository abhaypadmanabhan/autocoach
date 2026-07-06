import Foundation
import Speech
import AVFoundation

/// On-device voice dictation for free-text answers (M2). Uses
/// `SFSpeechRecognizer` + `AVAudioEngine`. Dictated answers are submitted with
/// `input_method: "voice"`.
///
/// `@MainActor`: `SFSpeechRecognizer` / `AVAudioEngine` are not Sendable and
/// must live on the main thread. Recognition result callbacks fire on an
/// internal queue; we hop back to the main actor to update ``transcript``.
///
/// Note: speech recognition is unavailable on some simulators (no mic). The
/// view degrades gracefully — the dictation affordance is disabled with a note
/// when `authorization == .denied`/`.restricted` or `isAvailable == false`.
@MainActor
@Observable
final class SpeechRecognizer {
    enum State: Equatable { case idle, requesting, listening, unavailable(String) }

    private(set) var state: State = .idle
    private(set) var transcript: String = ""
    /// Set true the moment any recognized text lands → caller marks input_method "voice".
    private(set) var didCaptureVoice: Bool = false

    private var recognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var locale = Locale.current

    init(locale: Locale = .current) {
        self.locale = locale
        self.recognizer = SFSpeechRecognizer(locale: locale)
    }

    var isAvailable: Bool { recognizer?.isAvailable ?? false }

    /// Request mic + speech permissions (call before first use).
    func requestAuthorization() async {
        state = .requesting
        // The completion handlers fire on a background queue. They must NOT inherit
        // this @MainActor function's isolation — mark @Sendable so Swift 6 doesn't
        // insert a main-actor executor assertion that traps off-thread. Resuming a
        // CheckedContinuation is thread-safe; the awaiting code resumes back on main.
        let mic = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            AVAudioSession.sharedInstance().requestRecordPermission { @Sendable granted in
                cont.resume(returning: granted)
            }
        }
        guard mic else { state = .unavailable("Microphone access denied."); return }

        let auth = await withCheckedContinuation { (cont: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { @Sendable status in cont.resume(returning: status) }
        }
        switch auth {
        case .authorized:
            if recognizer?.isAvailable == true {
                state = .idle
            } else {
                state = .unavailable("Speech recognition isn't available on this device.")
            }
        case .denied:
            state = .unavailable("Speech recognition access denied in Settings.")
        case .restricted:
            state = .unavailable("Speech recognition is restricted on this device.")
        case .notDetermined:
            state = .idle
        @unknown default:
            state = .idle
        }
    }

    /// Begin dictating. Appends recognized text to ``transcript`` live.
    func start() {
        guard recognizer?.isAvailable == true else {
            state = .unavailable("Speech recognition isn't available on this device.")
            return
        }
        cancel()

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true

        // Stop any prior task before starting a new one (one active task at a time).
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            state = .unavailable("Couldn't start the microphone.")
            return
        }

        let inputNode = engine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        // The tap block runs on a realtime audio thread — @Sendable so it doesn't
        // inherit start()'s main-actor isolation (which would trap off-thread).
        // `request.append` is safe to call from the tap; vouch for the capture.
        nonisolated(unsafe) let req = request
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { @Sendable buffer, _ in
            req.append(buffer)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            state = .unavailable("Couldn't start the microphone.")
            return
        }

        let task = recognizer!.recognitionTask(with: request) { @Sendable [weak self] result, error in
            // Fires on SFSpeech's own queue (@Sendable — no main-actor inheritance).
            // Extract Sendable values here, then hop to main to touch @Observable state.
            let text = result?.bestTranscription.formattedString
            let failed = error != nil
            Task { @MainActor [weak self] in
                guard let self else { return }
                if let text {
                    self.transcript = text
                    self.didCaptureVoice = true
                }
                if failed {
                    // Transient recognition error — stop cleanly (don't crash UI).
                    self.stop()
                }
            }
        }

        self.audioEngine = engine
        self.recognitionRequest = request
        self.recognitionTask = task
        self.state = .listening
    }

    /// Stop dictation, keep the accumulated transcript.
    func stop() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        audioEngine = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if state == .listening { state = .idle }
    }

    /// Stop and clear the transcript + voice flag (e.g. between questions).
    func reset() {
        stop()
        transcript = ""
        didCaptureVoice = false
    }

    private func cancel() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        audioEngine = nil
    }
}
