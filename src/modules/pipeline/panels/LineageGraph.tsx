import { useMemo } from "react";
import { useLanguage } from "@/i18n";
import { StepLineage } from "@/types/xan";
import {
  Lane,
  TraceStep,
  buildColumnTrace,
  buildLanes,
} from "@/modules/pipeline/panels/lib/columnLineage";

interface LineageGraphProps {
  lineage: StepLineage[];
  /** 当前追踪的列（结果列名或源列名） */
  tracedColumn?: string | null;
  /** 搜索词：命中的泳道保持亮，其余压暗 */
  query?: string;
  onTrace?: (name: string) => void;
}

const LANE_H = 46;
const LANE_TOP = 168;
const PAD = 24;
const LABEL_W = 166;
const LANE_START = PAD + LABEL_W + 10;
const FIRST_GATE = LANE_START + 120;
const GATE_GAP = 192;
const HEAD_NUM_Y = 100;
const HEAD_NAME_Y = 120;
const HEAD_CMD_Y = 136;
const GATE_TOP = 148;

const TRACED_STROKE = "stroke-primary";
const LANE_STROKE =
  "stroke-[color-mix(in_oklab,var(--foreground)_22%,transparent)]";

/** 粗略估个文本宽度，用来给泳道上的标签片留位置（CJK 按全宽算） */
function textWidth(text: string, mono: boolean): number {
  let width = 0;
  for (const char of text) {
    const cjk = /[\u3000-\u9fff]/.test(char);
    width += cjk ? (mono ? 9.5 : 10.5) : mono ? 5.9 : 6.4;
  }
  return width;
}

/**
 * 全屏泳道图（设计 045）：列是泳道，步骤是竖线。
 *
 * 只有发生变化的列在竖线上留下节点（改类型 / 生成 / 改名 / 移除），
 * 其余列只穿过竖线，行数写在竖线下方。
 */
export function LineageGraph({
  lineage,
  tracedColumn,
  query = "",
  onTrace,
}: LineageGraphProps) {
  const { t } = useLanguage();

  const lanes = useMemo(() => buildLanes(lineage), [lineage]);
  const traced = useMemo(
    () => (tracedColumn ? buildColumnTrace(lineage, tracedColumn) : null),
    [lineage, tracedColumn],
  );

  if (lineage.length === 0) return null;

  const stepCount = lineage.length;
  const gateX = (index: number) => FIRST_GATE + index * GATE_GAP;
  const laneEnd = gateX(stepCount - 1) + 44;
  const width = Math.max(laneEnd + 204, 1120);
  const axisY = LANE_TOP + Math.max(lanes.length, 1) * LANE_H + 40;
  const height = axisY + 104;
  const keyword = query.trim().toLowerCase();

  const first = lineage[0];
  const last = lineage[stepCount - 1];

  const isTracedLane = (lane: Lane) =>
    Boolean(
      traced &&
        lane.sourceName === traced.sourceName &&
        lane.finalName === traced.finalName,
    );

  const isDimmed = (lane: Lane) => {
    if (!keyword) return false;
    return (
      !lane.sourceName.toLowerCase().includes(keyword) &&
      !lane.finalName.toLowerCase().includes(keyword)
    );
  };

  const laneOpacity = (lane: Lane) => (isDimmed(lane) ? 0.28 : 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t.dataLineage}
    >
      {/* 表头：来源 / 结果 */}
      <text x={PAD} y={64} className="fill-foreground text-[12px]">
        {t.lineageSourceNode}
      </text>
      <text
        x={PAD}
        y={82}
        className="fill-muted-foreground font-mono text-[9.5px]"
      >
        {first.inputRowCount} {t.lineageRowsUnit} · {first.inputSchema.length}{" "}
        {t.lineageColumnsUnit}
      </text>
      <text
        x={laneEnd + 14}
        y={64}
        className="fill-foreground text-[12px]"
      >
        {t.lineageResultNode}
      </text>
      <text
        x={laneEnd + 14}
        y={82}
        className="fill-muted-foreground font-mono text-[9.5px]"
      >
        {last.outputRowCount} {t.lineageRowsUnit} ·{" "}
        {last.outputSchema.length} {t.lineageColumnsUnit}
      </text>

      {/* 步骤竖线 + 头部 + 行数 */}
      {lineage.map((step, index) => {
        const x = gateX(index);
        const previous = lineage[index - 1];
        const changed =
          !previous || previous.outputRowCount !== step.outputRowCount;
        return (
          <g key={step.stepId}>
            <line
              x1={x}
              y1={GATE_TOP}
              x2={x}
              y2={axisY - 26}
              className="stroke-[color-mix(in_oklab,var(--foreground)_14%,transparent)]"
              strokeWidth={1}
            />
            <text
              x={x}
              y={HEAD_NUM_Y}
              textAnchor="middle"
              className="fill-muted-foreground/70 font-mono text-[9.5px]"
            >
              {String(index + 1).padStart(2, "0")}
            </text>
            <text
              x={x}
              y={HEAD_NAME_Y}
              textAnchor="middle"
              className="fill-foreground text-[11.5px]"
            >
              {step.alias || step.commandName}
            </text>
            {step.alias && (
              <text
                x={x}
                y={HEAD_CMD_Y}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[9.5px]"
              >
                {step.commandName}
              </text>
            )}
            <text
              x={x}
              y={axisY}
              textAnchor="middle"
              className={
                changed
                  ? "fill-foreground font-mono text-[10px] tabular-nums"
                  : "fill-muted-foreground/60 font-mono text-[10px] tabular-nums"
              }
            >
              {step.outputRowCount} {t.lineageRowsUnit}
            </text>
          </g>
        );
      })}

      {/* 泳道 */}
      {lanes.map((lane, index) => {
        const y = LANE_TOP + index * LANE_H;
        const tracedLane = isTracedLane(lane);
        const events = lane.steps;
        const bornHere =
          events[0]?.kind === "derived" && events[0].columnIn === null;
        const x0 = bornHere ? gateX(events[0].index - 1) : LANE_START;
        const tail = events[events.length - 1];
        const x1 =
          !lane.survives && tail?.kind === "removed"
            ? gateX(tail.index - 1)
            : laneEnd;
        const dim = laneOpacity(lane);

        return (
          <g
            key={lane.key}
            opacity={dim}
            className={onTrace ? "cursor-pointer" : undefined}
            onClick={() => onTrace?.(lane.finalName)}
          >
            <title>{`${lane.sourceName} → ${lane.finalName}`}</title>
            {/* 命中区域 */}
            <line
              x1={x0}
              y1={y}
              x2={x1}
              y2={y}
              stroke="transparent"
              strokeWidth={16}
            />
            <line
              x1={x0}
              y1={y}
              x2={x1}
              y2={y}
              className={tracedLane ? TRACED_STROKE : LANE_STROKE}
              strokeWidth={tracedLane ? 2 : 1}
            />

            {/* 源列名 */}
            <text
              x={LANE_START - 14}
              y={y - 2}
              textAnchor="end"
              className={
                tracedLane
                  ? "fill-primary text-[12px]"
                  : lane.survives
                    ? "fill-foreground text-[12px]"
                    : "fill-muted-foreground text-[12px]"
              }
            >
              {lane.sourceName}
            </text>
            <text
              x={LANE_START - 14}
              y={y + 12}
              textAnchor="end"
              className="fill-muted-foreground/60 font-mono text-[9.5px]"
            >
              {lane.sourceType}
            </text>

            {/* 结果列名 */}
            {lane.survives && x1 === laneEnd && (
              <>
                <text
                  x={laneEnd + 14}
                  y={y - 2}
                  className={
                    tracedLane
                      ? "fill-primary text-[12px]"
                      : "fill-foreground text-[12px]"
                  }
                >
                  {lane.finalName}
                </text>
                <text
                  x={laneEnd + 14}
                  y={y + 12}
                  className="fill-muted-foreground/60 font-mono text-[9.5px]"
                >
                  {lane.finalType}
                </text>
              </>
            )}

            {/* 变化节点 */}
            {events.map((event) => (
              <LaneEvent
                key={`${lane.key}-${event.index}`}
                event={event}
                x={gateX(event.index - 1)}
                y={y}
                traced={tracedLane}
                groupKeyLabel={t.lineageGroupKey}
              />
            ))}

            {!lane.survives && tail?.kind === "removed" && (
              <text
                x={gateX(tail.index - 1) + 12}
                y={y + 4}
                className="fill-muted-foreground/70 text-[9.5px]"
              >
                {t.lineageRemoved}
              </text>
            )}
          </g>
        );
      })}

      {/* 图例 */}
      <line
        x1={PAD}
        y1={height - 34}
        x2={PAD + 28}
        y2={height - 34}
        className={TRACED_STROKE}
        strokeWidth={2}
      />
      <text
        x={PAD + 36}
        y={height - 30}
        className="fill-muted-foreground/70 text-[9.5px]"
      >
        {t.lineageTracedLane}
      </text>
      <line
        x1={PAD + 120}
        y1={height - 34}
        x2={PAD + 148}
        y2={height - 34}
        className={LANE_STROKE}
        strokeWidth={1}
      />
      <text
        x={PAD + 156}
        y={height - 30}
        className="fill-muted-foreground/70 text-[9.5px]"
      >
        {t.lineageOtherLane}
      </text>
      <path
        d={`M${PAD + 226} ${height - 38} l8 8 M${PAD + 234} ${height - 38} l-8 8`}
        className="stroke-muted-foreground/70"
        strokeWidth={1.2}
        fill="none"
      />
      <text
        x={PAD + 246}
        y={height - 30}
        className="fill-muted-foreground/70 text-[9.5px]"
      >
        {t.lineageRemovedHere}
      </text>
      <text
        x={width - PAD}
        y={height - 30}
        textAnchor="end"
        className="fill-muted-foreground/70 text-[9.5px]"
      >
        {t.lineageGraphHint}
      </text>
    </svg>
  );
}

interface LaneEventProps {
  event: TraceStep;
  x: number;
  y: number;
  traced: boolean;
  groupKeyLabel: string;
}

function LaneEvent({
  event,
  x,
  y,
  traced,
  groupKeyLabel,
}: LaneEventProps) {
  if (event.kind === "kept") {
    return event.groupKey ? (
      <text
        x={x + 12}
        y={y - 10}
        className="fill-muted-foreground/70 text-[9.5px]"
      >
        {groupKeyLabel}
      </text>
    ) : null;
  }

  if (event.kind === "removed") {
    return (
      <path
        d={`M${x - 4} ${y - 4} l8 8 M${x + 4} ${y - 4} l-8 8`}
        className="stroke-muted-foreground"
        strokeWidth={1.2}
        fill="none"
      />
    );
  }

  const label =
    event.kind === "cast"
      ? `${event.typeIn} → ${event.typeOut}`
      : event.columnOut || "";
  const mono = event.kind === "cast";
  const chipWidth = textWidth(label, mono) + 16;

  return (
    <g>
      <rect
        x={x - chipWidth / 2}
        y={y - 11}
        width={chipWidth}
        height={22}
        rx={6}
        className={
          traced
            ? "fill-background stroke-primary"
            : "fill-background stroke-[color-mix(in_oklab,var(--foreground)_22%,transparent)]"
        }
        strokeWidth={traced ? 1.2 : 1}
      />
      <text
        x={x}
        y={y + 3.5}
        textAnchor="middle"
        className={
          mono
            ? "fill-muted-foreground font-mono text-[9.5px]"
            : "fill-foreground text-[10.5px]"
        }
      >
        {label}
      </text>
    </g>
  );
}
