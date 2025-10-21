// frontend/src/components/ArtistCard.tsx
import React from 'react';

interface Track {
  title: string;
  album: string;
}

interface ArtistCardProps {
  name: string;
  imageUrl: string;
  topTracks: Track[];
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ name, imageUrl, topTracks }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 border border-gray-700">
      <img src={imageUrl} alt={name} className="w-40 h-40 rounded-full object-cover" />
      <div>
        <p className="text-gray-400 text-sm">검색 결과</p>
        <h2 className="text-3xl font-bold text-white mb-4">{name}</h2>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">대표곡 TOP 5</h3>
        <ul className="space-y-1">
          {topTracks.map((track, index) => (
            <li key={index} className="text-gray-400">
              <span className="text-white">{track.title}</span> - {track.album}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};