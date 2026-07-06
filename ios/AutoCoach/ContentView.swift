import SwiftUI

/// Milestone 1 placeholder — empty shell proving the project builds and launches.
/// No feature work here; screens land in Milestone 2 per ios/docs/architecture-research.md.
struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("01 / AUTOCOACH")
                .font(.system(.footnote, design: .monospaced))
                .foregroundStyle(Color("Ink"))
            Rectangle()
                .fill(Color("Ink"))
                .frame(height: 1)
            Text("Native iOS shell — Milestone 1")
                .font(.body)
                .foregroundStyle(Color("Ink"))
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color("Ground"))
    }
}

#Preview {
    ContentView()
}
