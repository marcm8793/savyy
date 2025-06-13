import { BarChart3 } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 shadow-lg">
        <BarChart3 className="h-5 w-5 text-white" />
      </div>
      <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent dark:from-orange-400 dark:to-orange-500">
        Savyy
      </span>
    </div>
  );
}

export default Logo;
