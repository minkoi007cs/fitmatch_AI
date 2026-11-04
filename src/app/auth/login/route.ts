import { NextRequest } from "next/server";
import { startLogin } from "@/lib/auth/start";
export async function GET(request: NextRequest) { return startLogin(request); }
