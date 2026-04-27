import CameraFeed from '../../components/camera/CameraFeed';
import DemographicsCard from '../../components/camera/DemographicsCard';
import VisitorCountWidget from '../../components/camera/VisitorCountWidget';
import TableFloorMini from '../../components/camera/TableFloorMini';
import { WeatherWidget } from '../../components/dashboard/WeatherWidget';
import { useLanguage } from '../../contexts/LanguageContext';

export default function CameraAnalyticsPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('dashboard.home.title')}</h1>
          <p className="text-sm text-ink-3 mt-1">{t('dashboard.home.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CameraFeed />
          <WeatherWidget />
        </div>
        <div className="space-y-6">
          <VisitorCountWidget />
          <DemographicsCard />
          <TableFloorMini />
        </div>
      </div>
    </div>
  );
}
