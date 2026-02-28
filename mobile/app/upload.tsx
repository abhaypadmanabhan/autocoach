import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, FontWeight } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useDocument } from '../hooks/useDocuments';
import { apiClient } from '../lib/api';

type UploadStage = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: '',
  uploading: 'Uploading file...',
  processing: 'Processing document...',
  ready: 'Document ready!',
  error: 'Upload failed',
};

const STAGE_PROGRESS: Record<UploadStage, number> = {
  idle: 0,
  uploading: 0.33,
  processing: 0.66,
  ready: 1,
  error: 0,
};

function FilePreviewCard({
  name,
  size,
  mimeType,
}: {
  name: string;
  size?: number;
  mimeType?: string | null;
}) {
  const isPDF = mimeType?.includes('pdf') || name.endsWith('.pdf');
  const sizeStr = size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '';

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[4] }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: Radius.lg,
          backgroundColor: isPDF ? '#EF4444' + '20' : '#6366F1' + '20',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 26 }}>{isPDF ? '📄' : '📊'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold, fontSize: Typography.sm }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: Typography.xs }}>
          {isPDF ? 'PDF' : 'PowerPoint'}{sizeStr ? ` · ${sizeStr}` : ''}
        </Text>
      </View>
    </Card>
  );
}

function StageProgressView({ stage }: { stage: UploadStage }) {
  const stages = [
    { key: 'uploading', label: 'Upload', icon: '⬆️' },
    { key: 'processing', label: 'Extract & Chunk', icon: '✂️' },
    { key: 'ready', label: 'Embed & Index', icon: '🧠' },
  ];

  const currentStageIndex =
    stage === 'uploading' ? 0 : stage === 'processing' ? 1 : stage === 'ready' ? 2 : -1;

  return (
    <View style={{ marginBottom: Spacing[4] }}>
      <ProgressBar progress={STAGE_PROGRESS[stage]} color={Colors.indigo} style={{ marginBottom: Spacing[4] }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {stages.map((s, i) => (
          <View key={s.key} style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 20 }}>{s.icon}</Text>
            <Text
              style={{
                fontSize: Typography.xs,
                color: i <= currentStageIndex ? Colors.textPrimary : Colors.textMuted,
                fontWeight: i === currentStageIndex ? FontWeight.semibold : FontWeight.normal,
              }}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
    size?: number;
    mimeType?: string | null;
  } | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { document } = useDocument(stage === 'processing' ? uploadedDocId : null);

  // When document becomes ready, update stage
  if (document?.status === 'ready' && stage === 'processing') {
    setStage('ready');
  }
  if (document?.status === 'failed' && stage === 'processing') {
    setStage('error');
    setErrorMessage('Document processing failed');
  }

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
      ],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedFile({
        name: asset.name,
        uri: asset.uri,
        size: asset.size,
        mimeType: asset.mimeType,
      });
      setStage('idle');
      setErrorMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStage('uploading');
    setErrorMessage(null);

    try {
      // Read file as base64, then create FormData
      const fileInfo = await FileSystem.getInfoAsync(selectedFile.uri);
      if (!fileInfo.exists) throw new Error('File not found');

      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType ?? 'application/octet-stream',
      } as any);

      const result = await apiClient.postFormData<{ id: string; status: string }>(
        '/documents/upload',
        formData
      );

      setUploadedDocId(result.id);
      setStage('processing');
    } catch (err: any) {
      setStage('error');
      setErrorMessage(err.message || 'Upload failed');
    }
  };

  const handleStartQuiz = () => {
    if (uploadedDocId) {
      router.replace({
        pathname: '/config',
        params: { document_id: uploadedDocId },
      });
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      {/* Handle bar */}
      <View style={{ alignItems: 'center', paddingTop: Spacing[2], marginBottom: Spacing[2] }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing[5],
          paddingBottom: insets.bottom + Spacing[6],
          paddingTop: Spacing[3],
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing[6] }}>
          <Text style={{ fontSize: Typography['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary }}>
            Upload Document
          </Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stage: idle / uploading / processing */}
        {stage === 'idle' && (
          <>
            {/* Drop Zone / Pick Button */}
            {!selectedFile ? (
              <TouchableOpacity
                onPress={handlePickFile}
                style={{
                  borderWidth: 2,
                  borderColor: Colors.border,
                  borderStyle: 'dashed',
                  borderRadius: Radius['2xl'],
                  padding: Spacing[8],
                  alignItems: 'center',
                  marginBottom: Spacing[5],
                }}
              >
                <Text style={{ fontSize: 48, marginBottom: Spacing[3] }}>📎</Text>
                <Text style={{ fontSize: Typography.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing[1] }}>
                  Choose a file
                </Text>
                <Text style={{ fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' }}>
                  PDF or PowerPoint (.pdf, .pptx)
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <FilePreviewCard
                  name={selectedFile.name}
                  size={selectedFile.size}
                  mimeType={selectedFile.mimeType}
                />
                <Button onPress={handlePickFile} variant="ghost" size="sm" style={{ marginBottom: Spacing[3] }}>
                  Change file
                </Button>
              </>
            )}

            {selectedFile && (
              <Button onPress={handleUpload} size="lg" fullWidth>
                Upload Document
              </Button>
            )}
          </>
        )}

        {(stage === 'uploading' || stage === 'processing') && (
          <>
            {selectedFile && (
              <FilePreviewCard
                name={selectedFile.name}
                size={selectedFile.size}
                mimeType={selectedFile.mimeType}
              />
            )}
            <Card style={{ marginBottom: Spacing[4] }}>
              <Text style={{ color: Colors.textPrimary, fontWeight: FontWeight.semibold, marginBottom: Spacing[3] }}>
                {STAGE_LABELS[stage]}
              </Text>
              <StageProgressView stage={stage} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2] }}>
                <ActivityIndicator size="small" color={Colors.indigo} />
                <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>
                  {stage === 'uploading' ? 'Sending file to server...' : 'Extracting text and building index...'}
                </Text>
              </View>
            </Card>
          </>
        )}

        {stage === 'ready' && (
          <>
            <View style={{ alignItems: 'center', marginBottom: Spacing[6] }}>
              <Text style={{ fontSize: 64, marginBottom: Spacing[3] }}>🎉</Text>
              <Text style={{ fontSize: Typography['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' }}>
                Document Ready!
              </Text>
              <Text style={{ fontSize: Typography.base, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing[2] }}>
                Your document has been processed and is ready for quizzing
              </Text>
            </View>
            <Button onPress={handleStartQuiz} size="lg" fullWidth style={{ marginBottom: Spacing[3] }}>
              Start Quiz →
            </Button>
            <Button onPress={handleClose} variant="ghost" size="lg" fullWidth>
              Back to Library
            </Button>
          </>
        )}

        {stage === 'error' && (
          <>
            <View style={{ alignItems: 'center', marginBottom: Spacing[6] }}>
              <Text style={{ fontSize: 64, marginBottom: Spacing[3] }}>❌</Text>
              <Text style={{ fontSize: Typography.xl, fontWeight: FontWeight.bold, color: Colors.error, textAlign: 'center' }}>
                Upload Failed
              </Text>
              {errorMessage && (
                <Text style={{ fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing[2] }}>
                  {errorMessage}
                </Text>
              )}
            </View>
            <Button
              onPress={() => {
                setStage('idle');
                setErrorMessage(null);
              }}
              size="lg"
              fullWidth
              style={{ marginBottom: Spacing[3] }}
            >
              Try Again
            </Button>
            <Button onPress={handleClose} variant="ghost" size="lg" fullWidth>
              Cancel
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}
