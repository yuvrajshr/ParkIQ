import { NextResponse } from "next/server";
import { listWardens } from "@/lib/db/store";

export function GET() {
  return NextResponse.json({ wardens: listWardens() });
}
