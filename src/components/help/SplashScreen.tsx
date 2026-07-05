import { Loader2 } from "lucide-react";

interface SplashScreenProps {
  loadingText?: string;
}

export function SplashScreen({ loadingText = "Initializing..." }: SplashScreenProps) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Logo/Title */}
        <div className="animate-slide-up text-4xl font-bold text-blue-600 dark:text-blue-400">
          Easy CSV
        </div>

        {/* Loading Animation */}
        <div className="animate-fade-in-delay-2 flex items-center gap-3 mt-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{loadingText}</span>
        </div>

        {/* Progress dots animation */}
        <div className="animate-fade-in-delay-2 flex gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="animate-fade-in-delay-3 absolute bottom-8 text-xs text-gray-400 dark:text-gray-500">
        Powered by xan
      </p>
    </div>
  );
}