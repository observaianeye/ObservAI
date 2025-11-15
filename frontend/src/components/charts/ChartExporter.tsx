import { useState } from 'react';
import { Download, FileImage, FileText, X } from 'lucide-react';

interface ChartExporterProps {
  chartRef: React.RefObject<HTMLCanvasElement>;
  data: any[];
  filename?: string;
}

export default function ChartExporter({ chartRef, data, filename = 'chart' }: ChartExporterProps) {
  const [showMenu, setShowMenu] = useState(false);

  const exportToPNG = () => {
    const canvas = chartRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    });
    setShowMenu(false);
  };

  const exportToSVG = () => {
    alert('SVG export would convert canvas to SVG format');
    setShowMenu(false);
  };

  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${filename}.csv`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Export chart"
      >
        <Download className="w-5 h-5 text-gray-600" />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 w-48 py-2 rounded-xl shadow-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.1)'
            }}
          >
            <button
              onClick={exportToPNG}
              className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-3"
            >
              <FileImage className="w-4 h-4 text-blue-600" />
              Export as PNG
            </button>
            <button
              onClick={exportToSVG}
              className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-3"
            >
              <FileImage className="w-4 h-4 text-violet-600" />
              Export as SVG
            </button>
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-3"
            >
              <FileText className="w-4 h-4 text-green-600" />
              Export as CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
