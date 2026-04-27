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
    id: '2',
    category: 'Getting Started',
    title: 'Understanding your dashboard',
    content: 'The Analytics Dashboard shows real-time visitor metrics, demographics, and traffic patterns. Key metrics include current occupancy, entry/exit counts, age and gender distribution, and movement heatmaps. All data updates in real-time as the camera streams.'
  },
  {
    id: '3',
    category: 'Camera',
    title: 'Connecting your camera',
    content: 'Select your camera source from Camera Selection: built-in webcam, phone camera (Phone Cam via iVCam/EpocCam virtual driver), IP camera (RTSP/HTTP), or video link. The system uses YOLO object detection and InsightFace for demographics. Ensure camera permissions are granted in your browser.'
  },
  {
    id: '4',
    category: 'Camera',
    title: 'Starting the Python backend',
    content: 'The Python analytics backend runs on port 5001. When you select a camera source, the backend starts automatically. If connection fails, check that the camera is reachable and refresh the page.'
  },
  {
    id: '5',
    category: 'Camera Analytics',
    title: 'Understanding detection overlays',
    content: 'Bounding boxes show detected people with color coding: green for entering, red for exiting, blue for present. Labels display gender (M/F/?), age range (e.g., 18-24), and dwell time in seconds.'
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
    question: 'How accurate is the AI analytics?',
    answer: 'ObservAI uses YOLO11L for person detection (95%+ accuracy) and InsightFace for demographics (92% accuracy). Performance depends on camera quality, lighting, and viewing angle. 1080p resolution is recommended.'
  },
  {
    question: 'What cameras are supported?',
    answer: 'ObservAI works with built-in webcams (Camera), phone cameras (Phone Cam), and IP cameras (RTSP/HTTP). On Windows, use EpocCam or iVCam to connect your iPhone as a virtual webcam via USB or WiFi — install the app on your iPhone and the PC driver from the respective website. For best results, use 1080p or higher resolution with good lighting.'
  },
  {
    question: 'How do I troubleshoot connection issues?',
    answer: 'If the camera fails to connect: 1) Check that the Python backend is running on port 5001, 2) Verify camera permissions in browser settings, 3) Restart the camera source from Camera Selection, 4) Try refreshing the page.'
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

      <div className="relative rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col backdrop-blur-xl bg-surface-1/90 border border-white/[0.08]">
        <div className="bg-gradient-to-r from-brand-500 via-accent-500 to-violet-500 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-white tracking-tight">Help Center</h2>
              <p className="text-white/80 text-sm">Find answers and learn how to use ObservAI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/15 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 border-b border-white/[0.08]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-4" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles, FAQs, and tutorials..."
              className="w-full pl-12 pr-4 py-3 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/40 outline-none text-sm placeholder:text-ink-4"
            />
          </div>
        </div>

        <div className="flex border-b border-white/[0.08]">
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'articles'
                ? 'text-brand-300 border-b-2 border-brand-400 bg-brand-500/15'
                : 'text-ink-3 hover:bg-white/[0.04]'
            }`}
          >
            <FileText className="w-5 h-5" strokeWidth={1.5} />
            Articles
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'faq'
                ? 'text-brand-300 border-b-2 border-brand-400 bg-brand-500/15'
                : 'text-ink-3 hover:bg-white/[0.04]'
            }`}
          >
            <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
            FAQ
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'videos'
                ? 'text-brand-300 border-b-2 border-brand-400 bg-brand-500/15'
                : 'text-ink-3 hover:bg-white/[0.04]'
            }`}
          >
            <Video className="w-5 h-5" strokeWidth={1.5} />
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
                    className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-brand'
                        : 'bg-surface-2/50 text-ink-3 hover:bg-surface-2/80 border border-white/[0.08]'
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
                    className="surface-card p-6 cursor-pointer hover:border-brand-500/30 transition-all"
                  >
                    <span className="text-xs font-bold text-brand-300 uppercase tracking-wide font-mono">
                      {article.category}
                    </span>
                    <h3 className="font-display text-lg font-semibold text-ink-0 mt-2 mb-3">{article.title}</h3>
                    <p className="text-sm text-ink-2 leading-relaxed">{article.content}</p>
                  </div>
                ))}
              </div>

              {filteredArticles.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-ink-4 mx-auto mb-4" strokeWidth={1.5} />
                  <h3 className="font-display text-lg font-semibold text-ink-0 mb-2">No articles found</h3>
                  <p className="text-ink-3">Try adjusting your search or browse all categories</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <div
                  key={index}
                  className="surface-card p-6 hover:border-brand-500/30 transition-all"
                >
                  <h3 className="font-display text-lg font-semibold text-ink-0 mb-3">{faq.question}</h3>
                  <p className="text-sm text-ink-2 leading-relaxed">{faq.answer}</p>
                </div>
              ))}

              {filteredFaqs.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-ink-4 mx-auto mb-4" strokeWidth={1.5} />
                  <h3 className="font-display text-lg font-semibold text-ink-0 mb-2">No FAQs found</h3>
                  <p className="text-ink-3">Try a different search term</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="surface-card overflow-hidden hover:border-brand-500/30 transition-all">
                <div className="aspect-video bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" strokeWidth={1.5} />
                </div>
                <div className="p-4">
                  <h3 className="font-display font-semibold text-ink-0 mb-2">Getting Started with ObservAI</h3>
                  <p className="text-sm text-ink-2">Learn the basics in 5 minutes</p>
                </div>
              </div>

              <div className="surface-card overflow-hidden hover:border-success/30 transition-all">
                <div className="aspect-video bg-gradient-to-br from-success to-brand-500 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" strokeWidth={1.5} />
                </div>
                <div className="p-4">
                  <h3 className="font-display font-semibold text-ink-0 mb-2">Setting Up Camera Analytics</h3>
                  <p className="text-sm text-ink-2">Connect and configure your cameras</p>
                </div>
              </div>

              <div className="surface-card overflow-hidden hover:border-warning/30 transition-all">
                <div className="aspect-video bg-gradient-to-br from-warning to-danger flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" strokeWidth={1.5} />
                </div>
                <div className="p-4">
                  <h3 className="font-display font-semibold text-ink-0 mb-2">Understanding Sales Reports</h3>
                  <p className="text-sm text-ink-2">Make data-driven decisions</p>
                </div>
              </div>

              <div className="surface-card overflow-hidden hover:border-violet-500/30 transition-all">
                <div className="aspect-video bg-gradient-to-br from-violet-500 to-accent-500 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" strokeWidth={1.5} />
                </div>
                <div className="p-4">
                  <h3 className="font-display font-semibold text-ink-0 mb-2">Managing Employee Schedules</h3>
                  <p className="text-sm text-ink-2">Optimize staffing and payroll</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
