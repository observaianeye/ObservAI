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
    title: 'How to set up your first camera',
    content: 'Connect your IP camera to the same network as your ObservAI system. Navigate to Camera > Add New Camera and enter your camera credentials. The system will automatically detect and configure optimal settings.'
  },
  {
    id: '2',
    category: 'Getting Started',
    title: 'Understanding your dashboard',
    content: 'The Overview dashboard provides real-time insights into your restaurant operations. Key metrics include sales, customer traffic, average order value, and labor costs. Each widget is interactive and can be customized.'
  },
  {
    id: '3',
    category: 'Sales & POS',
    title: 'How to view sales reports',
    content: 'Navigate to Sales in the sidebar. You can view sales by day, week, month, or custom date range. Export reports as CSV or PDF for accounting purposes. Filter by payment method, category, or staff member.'
  },
  {
    id: '4',
    category: 'Sales & POS',
    title: 'Understanding Average Order Value (AOV)',
    content: 'AOV is calculated by dividing total revenue by the number of orders. A higher AOV indicates customers are purchasing more per transaction. Use this metric to measure the effectiveness of upselling strategies.'
  },
  {
    id: '5',
    category: 'Camera Analytics',
    title: 'How camera analytics work',
    content: 'Our AI analyzes video feeds to detect people count, queue length, dwell time, and customer demographics. This data helps optimize staffing, reduce wait times, and improve customer experience. All processing happens locally for privacy.'
  },
  {
    id: '6',
    category: 'Camera Analytics',
    title: 'Setting up heat maps',
    content: 'Heat maps visualize customer traffic patterns. Navigate to Camera > Heat Maps to see which areas receive the most foot traffic. Use this data to optimize product placement and store layout.'
  },
  {
    id: '7',
    category: 'Employee Management',
    title: 'How to request shift changes',
    content: 'Go to My Shifts and click on an empty day or use the Request Shift button. Select your desired time range and add an optional note. Your manager will be notified and can approve or decline the request.'
  },
  {
    id: '8',
    category: 'Employee Management',
    title: 'Manager: Approving shift requests',
    content: 'Navigate to Labor Management to view pending shift requests. You can approve or decline with a single click, or use swipe gestures on mobile. Approved shifts automatically appear in the schedule.'
  },
  {
    id: '9',
    category: 'Payroll',
    title: 'Understanding your pay stub',
    content: 'Your pay stub shows Regular Hours, Overtime Hours, Tips, and Bonuses. Deductions include taxes and benefits (typically 12%). Net Pay is your take-home amount. Download pay stubs anytime from the Payroll page.'
  },
  {
    id: '10',
    category: 'Payroll',
    title: 'Manager: Processing payroll',
    content: 'Switch to Manager View in Payroll to see all employee pay. Filter by department or sort by hours/pay. Use Process All for bulk processing or process individually. Export reports for accounting software integration.'
  },
  {
    id: '11',
    category: 'Inventory',
    title: 'Setting up inventory tracking',
    content: 'Add your products in Inventory > Add Item. Set reorder points to receive automatic alerts when stock is low. The system tracks usage patterns and predicts when items will run out.'
  },
  {
    id: '12',
    category: 'AI Insights',
    title: 'Understanding AI recommendations',
    content: 'ObservAI analyzes historical data, weather, events, and trends to provide actionable recommendations. These include optimal staffing levels, inventory orders, pricing adjustments, and menu modifications.'
  }
];

const faqs = [
  {
    question: 'How does ObservAI protect customer privacy?',
    answer: 'All video processing happens on-device. We detect patterns and counts without storing individual faces or identifiable information. Data is encrypted at rest and in transit.'
  },
  {
    question: 'Can I access ObservAI from my phone?',
    answer: 'Yes! ObservAI is fully responsive and works on all devices. Download our mobile app for push notifications and on-the-go management.'
  },
  {
    question: 'How accurate is the AI analytics?',
    answer: 'Our AI achieves 95%+ accuracy in people counting and 92% in demographic detection. Accuracy improves over time as the system learns your specific environment.'
  },
  {
    question: 'What cameras are compatible?',
    answer: 'Most IP cameras with RTSP/ONVIF support work with ObservAI. We recommend 1080p or higher resolution for best results. Contact support for specific camera compatibility.'
  },
  {
    question: 'How do I export my data?',
    answer: 'Every report page has an Export button. You can download data as CSV, Excel, or PDF. Use our API for automated data integration with other systems.'
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

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
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

        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles, FAQs, and tutorials..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'articles'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
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
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                      {article.category}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-2 mb-3">{article.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{article.content}</p>
                  </div>
                ))}
              </div>

              {filteredArticles.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No articles found</h3>
                  <p className="text-gray-600">Try adjusting your search or browse all categories</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <div
                  key={index}
                  className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-all"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{faq.question}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              ))}

              {filteredFaqs.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No FAQs found</h3>
                  <p className="text-gray-600">Try a different search term</p>
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
                  <h3 className="font-bold text-gray-900 mb-2">Getting Started with ObservAI</h3>
                  <p className="text-sm text-gray-600">Learn the basics in 5 minutes</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                <div className="aspect-video bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-2">Setting Up Camera Analytics</h3>
                  <p className="text-sm text-gray-600">Connect and configure your cameras</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                <div className="aspect-video bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-2">Understanding Sales Reports</h3>
                  <p className="text-sm text-gray-600">Make data-driven decisions</p>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                <div className="aspect-video bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Video className="w-16 h-16 text-white" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-2">Managing Employee Schedules</h3>
                  <p className="text-sm text-gray-600">Optimize staffing and payroll</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
