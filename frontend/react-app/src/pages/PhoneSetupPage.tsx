import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

export function PhoneSetupPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState<{ connected: boolean; phoneNumber?: string }>({ connected: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/api/phone/status')
      .then((res) => setStatus(res))
      .catch(() => setStatus({ connected: false }));
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/phone/connect', { method: 'POST', body: JSON.stringify({ phoneNumber }) });
      setStatus({ connected: true, phoneNumber });
      setPhoneNumber('');
    } catch (err: any) {
      showToast(err.message || 'Failed to connect', 'error');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/phone/disconnect', { method: 'POST', body: JSON.stringify({}) });
      setStatus({ connected: false });
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-6 py-8 space-y-4">
        <h1 className="text-3xl font-bold">Phone Integration</h1>
        {status.connected ? (
          <div className="space-y-2">
            <div className="text-text-secondary">Connected: {status.phoneNumber}</div>
            <Button variant="destructive" onClick={disconnect} disabled={loading}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="+15551234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <Button onClick={connect} disabled={loading || !phoneNumber}>
              {loading ? 'Connecting…' : 'Connect Phone'}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

