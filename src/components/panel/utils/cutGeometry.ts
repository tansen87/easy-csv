// 切割部分信息
export interface CutPartInfo {
  nodeId: string;
  partIndex: 0 | 1;
  clipPath: string;
  fallDx: number;
  fallDy: number;
  fallRotation: number;
}

// 计算线段与矩形的两个交点
export function getCutIntersectionPoints(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  const { x: rx, y: ry, width: rw, height: rh } = rect;
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) return null;

  const intersections: { x: number; y: number }[] = [];

  // 检查与四条边的交点
  const edges = [
    { x1: rx, y1: ry, x2: rx + rw, y2: ry },           // 上边
    { x1: rx + rw, y1: ry, x2: rx + rw, y2: ry + rh }, // 右边
    { x1: rx, y1: ry + rh, x2: rx + rw, y2: ry + rh }, // 下边
    { x1: rx, y1: ry, x2: rx, y2: ry + rh },            // 左边
  ];

  for (const edge of edges) {
    const ex = edge.x2 - edge.x1;
    const ey = edge.y2 - edge.y1;

    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((edge.x1 - lineStart.x) * ey - (edge.y1 - lineStart.y) * ex) / denom;
    const u = ((edge.x1 - lineStart.x) * dy - (edge.y1 - lineStart.y) * dx) / denom;

    if (t >= -0.001 && t <= 1.001 && u >= -0.001 && u <= 1.001) {
      const px = lineStart.x + t * dx;
      const py = lineStart.y + t * dy;
      // 限制在矩形边界内
      const cx = Math.max(rx, Math.min(rx + rw, px));
      const cy = Math.max(ry, Math.min(ry + rh, py));
      intersections.push({ x: cx, y: cy });
    }
  }

  // 去重(距离小于2的点视为同一个)
  const unique: { x: number; y: number }[] = [];
  for (const p of intersections) {
    if (!unique.some(u => Math.abs(u.x - p.x) < 2 && Math.abs(u.y - p.y) < 2)) {
      unique.push(p);
    }
  }

  if (unique.length >= 2) {
    return { p1: unique[0], p2: unique[1] };
  }

  // 如果只有一个交点(切割线从角开始),添加角点作为第二个交点
  if (unique.length === 1) {
    const p = unique[0];
    // 找到最近的角
    const corners = [
      { x: rx, y: ry },
      { x: rx + rw, y: ry },
      { x: rx + rw, y: ry + rh },
      { x: rx, y: ry + rh },
    ];
    let nearestCorner = corners[0];
    let minDist = Infinity;
    for (const c of corners) {
      const dist = Math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearestCorner = c;
      }
    }
    return { p1: p, p2: nearestCorner };
  }

  return null;
}

// 根据切割线和交点生成两部分的 clip-path 多边形
export function generateCutClipPaths(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): { partA: string; partB: string } {
  const { x: rx, y: ry, width: rw, height: rh } = rect;

  // 矩形的四个角
  const corners = [
    { x: rx, y: ry },           // 左上 (TL)
    { x: rx + rw, y: ry },      // 右上 (TR)
    { x: rx + rw, y: ry + rh }, // 右下 (BR)
    { x: rx, y: ry + rh },      // 左下 (BL)
  ];

  // 计算每个角在切割线的哪一侧(使用叉积)
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const lineDx = p2.x - p1.x;
  const lineDy = p2.y - p1.y;

  const sideA: { x: number; y: number }[] = []; // 切割线左侧
  const sideB: { x: number; y: number }[] = []; // 切割线右侧

  for (const corner of corners) {
    const dx = corner.x - p1.x;
    const dy = corner.y - p1.y;
    const c = cross(lineDx, lineDy, dx, dy);

    if (c >= 0) {
      sideA.push(corner);
    } else {
      sideB.push(corner);
    }
  }

  // 构建多边形:角点 + 交点
  const buildPolygon = (side: { x: number; y: number }[]): string => {
    if (side.length === 0) return '';

    // 按角度排序角点(相对于 p1)
    const sorted = [...side].sort((a, b) => {
      const angleA = Math.atan2(a.y - p1.y, a.x - p1.x);
      const angleB = Math.atan2(b.y - p1.y, b.x - p1.x);
      return angleA - angleB;
    });

    // 构建多边形:交点p1 -> 排序的角点 -> 交点p2 -> 回到p1
    const points = [p1, ...sorted, p2];
    return `polygon(${points.map(p => `${p.x}px ${p.y}px`).join(', ')})`;
  };

  const partA = buildPolygon(sideA);
  const partB = buildPolygon(sideB);

  return { partA, partB };
}

// 计算坠落方向(重力 + 切割方向混合)
export function calculateFallVector(
  cutPath: { x: number; y: number }[]
): { dx: number; dy: number; rotation: number } {
  if (cutPath.length < 2) {
    return { dx: 0, dy: 200, rotation: 15 };
  }

  // 切割方向:从末尾两点计算
  const last = cutPath[cutPath.length - 1];
  const prev = cutPath[cutPath.length - 2];
  let cutDx = last.x - prev.x;
  let cutDy = last.y - prev.y;
  const cutLen = Math.sqrt(cutDx * cutDx + cutDy * cutDy);

  if (cutLen > 0) {
    cutDx /= cutLen;
    cutDy /= cutLen;
  }

  // 混合:70% 重力方向(向下) + 30% 切割方向
  const gravityWeight = 0.7;
  const cutWeight = 0.3;
  const fdx = cutDx * cutWeight * 120;
  const fdy = (1 * gravityWeight + cutDy * cutWeight) * 200;

  // 旋转角度:根据方向计算
  const angle = Math.atan2(cutDx, 1) * (180 / Math.PI);
  const rotation = Math.max(-30, Math.min(30, angle * 0.5));

  return { dx: fdx, dy: fdy, rotation };
}

// 点到线段的距离
export function pointToLineDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

// 两条线段相交检测
export function linesIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// 线段与矩形相交检测
export function lineIntersectsRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: DOMRect
): boolean {
  const rectLines = [
    { x1: rect.left, y1: rect.top, x2: rect.right, y2: rect.top },
    { x1: rect.right, y1: rect.top, x2: rect.right, y2: rect.bottom },
    { x1: rect.right, y1: rect.bottom, x2: rect.left, y2: rect.bottom },
    { x1: rect.left, y1: rect.bottom, x2: rect.left, y2: rect.top },
  ];

  for (const rectLine of rectLines) {
    if (linesIntersect(
      p1.x, p1.y, p2.x, p2.y,
      rectLine.x1, rectLine.y1, rectLine.x2, rectLine.y2
    )) {
      return true;
    }
  }

  return (
    (p1.x >= rect.left && p1.x <= rect.right && p1.y >= rect.top && p1.y <= rect.bottom) ||
    (p2.x >= rect.left && p2.x <= rect.right && p2.y >= rect.top && p2.y <= rect.bottom)
  );
}
