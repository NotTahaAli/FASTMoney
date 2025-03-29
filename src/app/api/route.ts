import { response } from "@/utils/response.util";

export async function GET(_request: Request) {
    return response({ status: "API is running" }, 200);
}