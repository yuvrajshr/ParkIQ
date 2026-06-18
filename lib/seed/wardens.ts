import type { Warden } from "@/lib/types";

/** Field wardens with a home position on the map. The dispatcher picks the nearest
 *  `available` one. Names are generic placeholders. */
export const SEED_WARDENS: Warden[] = [
  { id: "w1", name: "Warden Unit 12", point: [77.6085, 12.9740], status: "available" },
  { id: "w2", name: "Warden Unit 07", point: [77.6390, 12.9760], status: "available" },
  { id: "w3", name: "Warden Unit 21", point: [77.6210, 12.9360], status: "available" },
  { id: "w4", name: "Warden Unit 03", point: [77.5840, 12.9270], status: "available" },
  { id: "w5", name: "Warden Unit 18", point: [77.6960, 12.9550], status: "available" },
  { id: "w6", name: "Warden Unit 29", point: [77.6050, 12.9700], status: "available" },
  { id: "w7", name: "Warden Unit 14", point: [77.7420, 12.9690], status: "available" },
  { id: "w8", name: "Warden Unit 09", point: [77.6660, 12.9200], status: "available" },
  { id: "w9", name: "Warden Unit 25", point: [77.6100, 12.9820], status: "off" },
];
