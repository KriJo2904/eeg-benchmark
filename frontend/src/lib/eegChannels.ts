import type { RecordMetadata } from '../types';

function isAnnotationChannel(label: string) {
  return label.toLowerCase().includes('annotation');
}

export function recordEegLabels(metadata: RecordMetadata): string[] {
  return metadata.channels.filter((c) => !isAnnotationChannel(c.label)).map((c) => c.label);
}

export function firstEegLabel(metadata: RecordMetadata): string {
  const first = metadata.channels.find((c) => c.label && !isAnnotationChannel(c.label));
  return first?.label ?? metadata.channels[0]?.label ?? '';
}
