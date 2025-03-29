import { response } from "@/utils/response.util";

export async function GET() {
    return response({ status: "API is running" }, 200);
}