export interface ImportResult {
    platform: string;
    name: string;
    image: string | null;
    songNames: string[];
    count: number;
    success: boolean;
}
