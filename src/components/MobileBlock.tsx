"use client";

export default function MobileBlock({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* PC: 通常表示 */}
      <div className="hidden md:contents">{children}</div>

      {/* スマホ: ブロック画面 */}
      <div className="md:hidden min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 text-center max-w-sm w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">株式会社FRED</h1>
          <p className="text-sm text-gray-500 mb-4">勤怠管理システム</p>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700 font-medium">
              こちらはPCからのみログイン可能です
            </p>
            <p className="text-xs text-gray-400 mt-2">
              パソコンのブラウザからアクセスしてください
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
