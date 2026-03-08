import type { PipelineBucket } from "@/lib/dashboard";
import { formatCurrency, pipelineStatusLabel } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type InstrumentPipelineWidgetProps = {
  buckets: PipelineBucket[];
};

export function InstrumentPipelineWidget({ buckets }: InstrumentPipelineWidgetProps) {
  return (
    <WidgetCard title="Instrument Pipeline" subtitle="Anzahl und Volumen je Status">
      <div className="pipeline-grid">
        {buckets.map((bucket) => (
          <div key={bucket.status} className="pipeline-card">
            <p>{pipelineStatusLabel(bucket.status)}</p>
            <strong>{bucket.count}</strong>
            <span>{formatCurrency(bucket.totalVolume, bucket.currency)}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
