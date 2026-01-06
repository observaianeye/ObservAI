import ZoneCanvas from '../../components/camera/ZoneCanvas';

export default function ZoneLabelingPage() {
  return (
    <div className="p-6">
      <ZoneCanvas />
      
      <div className="mt-6 rounded-xl border border-blue-500/30 p-6 shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:border-blue-500/50 backdrop-blur-md bg-gray-900/80">
        <h3 className="text-lg font-bold text-white mb-3">How to Use Zone Labeling</h3>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <p>Go to <strong>Camera Analytics</strong> page and start your camera in Live mode</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <p>Return to this page and click <strong>"Capture Camera"</strong> to grab a snapshot of your camera view</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <p>Click <strong>"Add Zone"</strong> and draw rectangles on the snapshot to mark entrance/exit areas</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <p>Select each zone and change its type (Entrance/Exit) and name in the zone list</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <p>Click <strong>"Save All"</strong> to save your zones - they will appear as overlays on the live camera feed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
