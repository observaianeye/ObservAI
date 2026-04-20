import CameraFeed from '../../components/camera/CameraFeed';
import GenderChart from '../../components/camera/GenderChart';
import AgeChart from '../../components/camera/AgeChart';
import VisitorCountWidget from '../../components/camera/VisitorCountWidget';
import DwellTimeWidget from '../../components/camera/DwellTimeWidget';
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
        <div className="lg:col-span-2">
          <CameraFeed />
        </div>
        <div className="space-y-6">
          <VisitorCountWidget />
          <DwellTimeWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GenderChart />
        <AgeChart />
      </div>
    </div>
  );
}
