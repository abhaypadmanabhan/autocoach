import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, Typography, FontWeight } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocuments, useDeleteDocument, type Document } from '../../hooks/useDocuments';

type FilterStatus = 'all' | 'ready' | 'processing' | 'failed';

function FileIcon({ fileType }: { fileType: string }) {
  const isPDF = fileType?.toLowerCase().includes('pdf');
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: Radius.md,
        backgroundColor: isPDF ? '#EF4444' + '20' : Colors.indigo + '20',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 22 }}>{isPDF ? '📄' : '📊'}</Text>
    </View>
  );
}

function DocumentCard({
  doc,
  onDelete,
}: {
  doc: Document;
  onDelete: (id: string) => void;
}) {
  const displayName = doc.ai_title ?? doc.filename;
  const mastery = doc.mastery_percentage ?? 0;

  const statusMap: Record<string, 'ready' | 'processing' | 'pending' | 'failed'> = {
    ready: 'ready',
    processing: 'processing',
    pending: 'pending',
    failed: 'failed',
  };

  return (
    <TouchableOpacity
      onPress={() => {
        if (doc.status === 'ready') {
          router.push({ pathname: '/config', params: { document_id: doc.id } });
        }
      }}
      onLongPress={() => {
        Alert.alert(
          'Delete Document',
          `Delete "${displayName}"? This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(doc.id) },
          ]
        );
      }}
      activeOpacity={0.8}
      style={{
        flex: 1,
        margin: Spacing[2],
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius['2xl'],
        padding: Spacing[4],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing[3] }}>
        <FileIcon fileType={doc.file_type} />
        <Badge status={statusMap[doc.status] ?? 'info'} />
      </View>

      <Text
        style={{
          color: Colors.textPrimary,
          fontWeight: FontWeight.semibold,
          fontFamily: Fonts.semibold,
          fontSize: Typography.sm,
          marginBottom: Spacing[2],
        }}
        numberOfLines={2}
      >
        {displayName}
      </Text>

      {doc.status === 'ready' && (
        <View style={{ marginTop: 'auto' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular }}>Mastery</Text>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Fonts.regular }}>{mastery}%</Text>
          </View>
          <ProgressBar progress={mastery / 100} color={Colors.indigo} height={4} />
        </View>
      )}

      {doc.status === 'processing' && (
        <Text style={{ color: Colors.warning, fontSize: Typography.xs, fontFamily: Fonts.regular, marginTop: Spacing[2] }}>
          Processing...
        </Text>
      )}
    </TouchableOpacity>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[8] }}>
      <Text style={{ fontSize: 72, marginBottom: Spacing[4] }}>📚</Text>
      <Text
        style={{
          fontSize: Typography.xl,
          fontWeight: FontWeight.bold,
          fontFamily: Fonts.bold,
          color: Colors.textPrimary,
          textAlign: 'center',
          marginBottom: Spacing[2],
        }}
      >
        No documents yet
      </Text>
      <Text
        style={{
          fontSize: Typography.base,
          fontFamily: Fonts.regular,
          color: Colors.textMuted,
          textAlign: 'center',
          marginBottom: Spacing[6],
        }}
      >
        Upload a PDF or PowerPoint to start your AI-powered learning journey
      </Text>
      <TouchableOpacity
        onPress={onUpload}
        style={{
          backgroundColor: Colors.coral,
          borderRadius: Radius.lg,
          paddingVertical: Spacing[3],
          paddingHorizontal: Spacing[6],
        }}
      >
        <Text style={{ color: Colors.white, fontWeight: FontWeight.bold, fontFamily: Fonts.bold, fontSize: Typography.base }}>
          Upload Document
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { documents, isLoading, refetch } = useDocuments();
  const { deleteDocument, deleting } = useDeleteDocument();

  const filters: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Ready', value: 'ready' },
    { label: 'Processing', value: 'processing' },
    { label: 'Failed', value: 'failed' },
  ];

  const filtered = useMemo(() => {
    let list = documents;
    if (filter !== 'all') list = list.filter((d) => d.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          (d.ai_title ?? d.filename).toLowerCase().includes(q)
      );
    }
    return list;
  }, [documents, filter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete document');
    }
  };

  const handleUpload = () => {
    router.push('/upload');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.navy }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + Spacing[4], paddingHorizontal: Spacing[5], paddingBottom: Spacing[3] }}>
        <Text style={{ fontSize: Typography['2xl'], fontWeight: FontWeight.bold, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing[4] }}>
          Library
        </Text>

        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.card,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.xl,
            paddingHorizontal: Spacing[3],
            marginBottom: Spacing[3],
          }}
        >
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search documents..."
            placeholderTextColor={Colors.textMuted}
            style={{ flex: 1, color: Colors.textPrimary, fontSize: Typography.base, fontFamily: Fonts.regular, paddingVertical: Spacing[3], paddingHorizontal: Spacing[2] }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={{
                paddingHorizontal: Spacing[3],
                paddingVertical: Spacing[1],
                borderRadius: Radius.full,
                backgroundColor: filter === f.value ? Colors.coral : Colors.card,
                borderWidth: 1,
                borderColor: filter === f.value ? Colors.coral : Colors.border,
              }}
            >
              <Text
                style={{
                  color: filter === f.value ? Colors.white : Colors.textMuted,
                  fontSize: Typography.sm,
                  fontFamily: filter === f.value ? Fonts.semibold : Fonts.regular,
                  fontWeight: filter === f.value ? FontWeight.semibold : FontWeight.normal,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Document grid */}
      {isLoading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing[2] }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: '50%', padding: Spacing[2] }}>
              <Skeleton height={160} borderRadius={Radius['2xl']} />
            </View>
          ))}
        </View>
      ) : filtered.length === 0 ? (
        documents.length === 0 ? (
          <EmptyState onUpload={handleUpload} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.base, fontFamily: Fonts.regular }}>
              No documents match your filter
            </Text>
          </View>
        )
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: '50%' }}>
              <DocumentCard doc={item} onDelete={handleDelete} />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: Spacing[3], paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.coral} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={handleUpload}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 90,
          right: Spacing[5],
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: Colors.coral,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: Colors.coral,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}
