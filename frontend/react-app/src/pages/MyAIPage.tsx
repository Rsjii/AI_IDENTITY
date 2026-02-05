import { useSearchParams, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { IdentityEditPage } from './IdentityEditPage';
import { KnowledgeBasePage } from './KnowledgeBasePage';
import { MirrorPage } from './MirrorPage';

type MyAITab = 'setup' | 'train' | 'preview';

const TAB_LABELS: Record<MyAITab, string> = {
  setup: 'Setup',
  train: 'Train',
  preview: 'Preview',
};

export function MyAIPage() {
  const { state } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as MyAITab | null;
  const activeTab: MyAITab =
    tabParam && ['setup', 'train', 'preview'].includes(tabParam) ? tabParam : 'setup';

  if (state.status === 'authenticated' && state.user?.userType !== 'creator') {
    return <Navigate to="/explore" replace />;
  }

  const setTab = (tab: MyAITab) => {
    setSearchParams({ tab });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">My AI</h1>
          <p className="text-text-secondary mt-0.5 text-sm">Configure your AI clone</p>
        </div>

        {/* Tab Pills */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
          {(['setup', 'train', 'preview'] as MyAITab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeTab === tab
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'setup' && <IdentityEditPage embedded />}
        {activeTab === 'train' && <KnowledgeBasePage embedded />}
        {activeTab === 'preview' && <MirrorPage embedded />}
      </div>
    </Layout>
  );
}
