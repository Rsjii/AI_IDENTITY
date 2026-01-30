import { Card, CardContent } from '@/components/ui/card';

interface Testimonial {
  name: string;
  role: string;
  photo?: string;
  revenue?: string;
  text: string;
  useCase: 'fitness' | 'tech' | 'finance' | 'other';
}

const testimonials: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Fitness Coach',
    revenue: '$12K/month',
    text: 'My AI handles all nutrition questions while I train. Game changer!',
    useCase: 'fitness',
  },
  {
    name: 'Alex Kumar',
    role: 'Tech Creator',
    revenue: '$8K/month',
    text: 'Deployed to WhatsApp in 5 minutes. My audience loves it.',
    useCase: 'tech',
  },
  {
    name: 'Maria Rodriguez',
    role: 'Finance Advisor',
    revenue: '$15K/month',
    text: '24/7 consultations. I sleep while my AI earns.',
    useCase: 'finance',
  },
];

export function Testimonials() {
  return (
    <div className="mt-12 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Join 5,000+ creators already cloned</h2>
        <p className="text-muted-foreground">$2M+ earned by creators using Selflyx</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {testimonials.map((t, i) => (
          <Card key={i} className="glass">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold">
                  {t.name[0]}
                </div>
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-muted-foreground">{t.role}</div>
                </div>
              </div>
              <p className="text-sm">{t.text}</p>
              {t.revenue && (
                <div className="text-xs font-medium text-primary">Earning {t.revenue}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}




