import type { Order, OrderStatus } from "./types";

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function cycleTimeMs(order: Order) {
  if (!order.delivered_at) return null;
  return new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime();
}

export function getOrderCycleLabel(order: Order) {
  const ms = cycleTimeMs(order);
  return ms === null ? "-" : formatDuration(ms);
}

export function isLate(order: Order, limitSeconds = 180) {
  const ms = cycleTimeMs(order);
  if (ms === null) return false;
  return ms > limitSeconds * 1000;
}

export function statusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    pendiente: "Pendiente",
    montaje1: "En Montaje 1",
    montaje1_terminado: "Listo para Montaje 2",
    montaje2: "En Montaje 2",
    montaje2_terminado: "Listo para Calidad",
    listo_para_entrega: "Listo para Despacho",
    error: "Error",
    entregado: "Entregado",
  };
  return labels[status];
}

export function calculateMetrics(orders: Order[], lateLimitSeconds = 180) {
  const total = orders.length;
  const delivered = orders.filter((o) => o.status === "entregado").length;
  const errors = orders.filter((o) => o.status === "error" || o.quality === "Error").length;
  const late = orders.filter((o) => isLate(o, lateLimitSeconds)).length;
  const wip = orders.filter(
    (o) => !["pendiente", "entregado", "error"].includes(o.status)
  ).length;

  const cycleTimes = orders
    .map(cycleTimeMs)
    .filter((v): v is number => v !== null && v >= 0);
  const avgCycle = cycleTimes.length
    ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    : 0;

  const stationCounts = {
    Pendiente: orders.filter((o) => o.status === "pendiente").length,
    "Montaje 1": orders.filter((o) => o.status === "montaje1").length,
    "Montaje 2": orders.filter((o) => o.status === "montaje2").length,
    Calidad: orders.filter((o) => o.status === "montaje2_terminado").length,
    Despacho: orders.filter((o) => o.status === "listo_para_entrega").length,
  };
  const bottleneck = Object.entries(stationCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    total,
    delivered,
    errors,
    late,
    wip,
    avgCycleLabel: formatDuration(avgCycle),
    onTimeRate: total ? Math.round(((delivered - late) / total) * 100) : 0,
    qualityRate: total ? Math.round(((total - errors) / total) * 100) : 0,
    bottleneck: bottleneck && bottleneck[1] > 0 ? bottleneck[0] : "-",
    stationCounts,
  };
}
