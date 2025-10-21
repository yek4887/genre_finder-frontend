import React from 'react';

interface GenreCardProps {
  genre: {
    name: string;
    description: string;
    artists: string[];
  };
}

const GenreCard: React.FC<GenreCardProps> = ({ genre }) => {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-700">
      <div className="space-y-4">
        {/* 장르 이름 */}
        <h3 className="text-2xl font-bold text-white mb-2">
          {genre.name}
        </h3>
        
        {/* 장르 설명 */}
        <p className="text-gray-300 text-base leading-relaxed">
          {genre.description}
        </p>
        
        {/* 대표 아티스트 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            대표 아티스트
          </h4>
          <div className="flex flex-wrap gap-2">
            {genre.artists.map((artist, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full font-medium"
              >
                {artist}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenreCard;
