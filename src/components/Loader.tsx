import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {/* 스피너 애니메이션 */}
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-pink-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
      </div>
      
      {/* 로딩 텍스트 */}
      <div className="text-center">
        <p className="text-gray-300 text-lg font-medium">
          AI가 당신을 위한 장르를 찾고 있어요...
        </p>
        <p className="text-gray-500 text-sm mt-1">
          잠시만 기다려주세요
        </p>
      </div>
      
      {/* 점 애니메이션 */}
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
};

export default Loader;
