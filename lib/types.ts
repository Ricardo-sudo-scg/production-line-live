export type Product = "Bicolor" | "Amarillo" | "Rojo";

export type Role =
  | "Cliente"
  | "Montaje 1"
  | "Montaje 2"
  | "Calidad"
  | "Despacho"
  | "Profesor";

export type OrderStatus =
  | "pendiente"
  | "montaje1"
  | "montaje1_terminado"
  | "montaje2"
  | "montaje2_terminado"
  | "listo_para_entrega"
  | "error"
  | "entregado";

export type Order = {
  id: string;
  room_code: string;
  team: string;
  round: number;
  product: Product;
  status: OrderStatus;
  requested_by: string | null;
  current_station: string | null;
  created_at: string;
  montaje1_start: string | null;
  montaje1_end: string | null;
  montaje2_start: string | null;
  montaje2_end: string | null;
  quality_start: string | null;
  quality: "OK" | "Error" | null;
  delivered_at: string | null;
  error_count: number;
  notes: string | null;
};

export type PlayerSession = {
  roomCode: string;
  name: string;
  team: string;
  round: number;
  role: Role;
};

export const PRODUCTS: Product[] = ["Bicolor", "Amarillo", "Rojo"];
export const ROLES: Role[] = [
  "Cliente",
  "Montaje 1",
  "Montaje 2",
  "Calidad",
  "Despacho",
  "Profesor",
];
export const TEAMS = ["A", "B", "C", "D"];
