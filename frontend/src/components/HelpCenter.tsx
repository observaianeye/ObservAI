import { useState } from 'react';
import { X, Search, BookOpen, Video, FileText, MessageCircle } from 'lucide-react';

interface HelpArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  videoUrl?: string;
}

const helpArticles: HelpArticle[] = [
  {
    id: '1',
    category: 'Getting Started',
    title: 'Switching between Demo and Live Mode',
    content: 'ObservAI has two modes: Demo mode uses simulated data for testing, while Live mode connects to your camera for real-time analytics. Toggle between modes using the switch in the top-right corner of the dashboard.'
  },
  {
    id: '2',
    category: 'Getting Started',
    title: 'Understanding your dashboard',
    content: 'The Analytics Dashboard shows real-time visitor metrics, demographics, and traffic patterns. Key metrics include current occupancy, entry/exit counts, age and gender distribution, and movement heatmaps. All data updates in real-time when using Live mode.'
  },
  {
    id: '3',
    category: 'Live Mode',
    title: 'Connecting your camera',
    content: 'In Live mode, select your camera source: MacBook webcam, iPhone (via Continuity Camera), or IP camera. The system uses YOLO object detection and InsightFace for demographics. Ensure camera permissions are granted in your browser.'
  },
  {
    id: '4',
    category: 'Live Mode',
    title: 'Starting the Python backend',
    content: 'The Python analytics backend runs on port 5001. When you switch to Live mode and select a camera, the system automatically starts the backend. Check Diagnostics if connection fails.'
  },
  {
    id: '5',
    category: 'Camera Analytics',
    title: 'Understanding detection overlays',
    content: 'In Live mode, bounding boxes show detected people with color coding: green for entering, red for exiting, blue for present. Labels display gender (M/F/?), age range (e.g., 18-24), and dwell time in seconds.'
  },
  {
    id: '6',
    category: 'Camera Analytics',
    title: 'Using heat maps',
    content: 'Enable the heatmap overlay to visualize movement patterns. The heatmap shows where people spend the most time: red indicates high activity, orange medium, yellow low. This data updates in real-time based on tracking history.'
  },
  {
    id: '7',
    category: 'Zone Labeling',
    title: 'Setting up zones',
    content: 'Use Zone Labeling to define entrance and exit zones. Draw rectangles on the camera feed to mark specific areas. The system tracks when people enter or leave these zones for accurate traffic metrics.'
  },
  {
    id: '8',
    category: 'AI Insights',
    title: 'Understanding demographics',
    content: 'ObservAI uses InsightFace AI to estimate age (in 7 ranges: 0-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+) and gender. This data is displayed in charts and aggregated for privacy - no individual faces are stored.'
  },
  {
    id: '9',
    category: 'Historical Data',
    title: 'Viewing past analytics',
    content: 'Navigate to Historical Data to view trends over time. Compare different time periods, analyze peak hours, and track demographic changes. Export data as CSV for further analysis.'
  },
  {
    id: '10',
    category: 'Privacy & Security',
    title: 'How ObservAI protects privacy',
    content: 'All video processing happens locally on your device. We detect patterns and counts without storing individual faces. Data is anonymized and aggregated. You can enable privacy mode to blur faces in recordings.'
  }
];

const faqs = [
  {
    question: 'How does ObservAI protect privacy?',
    answer: 'All video processing happens locally on your device. ObservAI detects patterns and counts without storing individual faces or identifiable information. Demographics are aggregated and anonymized. You can enable privacy mode to blur faces.'
  },
  {
    question: 'What is the difference between Demo and Live mode?',
    answer: 'Demo mode uses simulated, realistic data for testing and demonstrations. Live mode connects to your camera for real-time analytics. Toggle between modes anytime using the switch in the top-right corner.'
  },
  {
    question: 'How accurate is the AI analytics?',
    answer: 'ObservAI uses YOLOv12 for person detection (95%+ accuracy) and InsightFace for demographics (92% accuracy). Performance depends on camera quality, lighting, and viewing angle. 1080p resolution is recommended.'
  },
  {
    question: 'What cameras are supported?',
    answer: 'ObservAI works with MacBook webcams, iPhone cameras (via Continuity Camera), IP cameras (RTSP/HTTP), and screen sharing for Zoom. For best results, use 1080p or higher resolution cameras with good lighting.'
  },
  {
    question: 'How do I troubleshoot connection issues?',
    answer: 'If Live mode fails to connect: 1) Check that Python backend is running on port 5001, 2) Verify camera permissions in browser settings, 3) Check Diagnostics for detailed status, 4) Try refreshing the page. See Diagnostics for more help.'
  }
];

interface HelpCenterProps {
  onClose: () => void;
}

export default function HelpCenter({ onClose }: HelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'articles' | 'faq' | 'videos'>('articles');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(helpArticles.map(a => a.category))];

  const filteredArticles = helpArticles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col backdrop-blur-md bg-gray-900/90 border border-blue-500/30">
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Help Center</h2>
              <p className="text-blue-100 text-sm">Find answers and learn how to use ObservAI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-6 border-b border-blue-500/30">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles, FAQs, and tutorials..."
              className="w-full pl-12 pr-4 py-3 border-2 border-blue-500/30 bg-gray-800/50 text-white rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="flex border-b border-blue-500/30">
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'articles'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/20'
                : 'text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <FileText className="w-5 h-5" />
            Articles
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'faq'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            FAQ
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'videos'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Video className="w-5 h-5" />
            Videos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'articles' && (
            <div>
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800/70 border border-blue-500/30'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredArticles.map(article => (
                  <div
                    key={article.id}
                    className="p-6 border-2 border-blue-500/30 rounded-xl hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all cursor-pointer bg-gray-900/80 backdrop-blur-md"
                  >
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                      {article.category}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2 mb-3">{article.title}</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">{article.content}</p>
                  </div>
                ))}
              </div>

              {filteredArticles.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">No articles found</h3>
                  <p className="text-gray-400">Try adjusting your search or browse all categories</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <div
                  key={index}
                  className="p-6 border-2 border-blue-500/30 rounded-xl hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all bg-gray-900/80 backdrop-blur-md"
                >
                  <h3 className="text-lg font-bold text-white mb-3">{faq.question}</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{faq.answer}</p>
                </div>
              ))}

              {filteredFaqs.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">No FAQs found</h3>
                  <p className="text-gray-400">Try a different search term</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                <div className="aspect-video bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white mb-2">Getting Started with ObservAI</h3>
                  <p className="text-sm text-gray-300">Learn the basics in 5 minutes</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                <div className="aspect-video bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white mb-2">Setting Up Camera Analytics</h3>
                  <p className="text-sm text-gray-300">Connect and configure your cameras</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                <div className="aspect-video bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white mb-2">Understanding Sales Reports</h3>
                  <p className="text-sm text-gray-300">Make data-driven decisions</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                <div className="aspect-video bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white mb-2">Managing Employee Schedules</h3>
                  <p className="text-sm text-gray-300">Optimize staffing and payroll</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
