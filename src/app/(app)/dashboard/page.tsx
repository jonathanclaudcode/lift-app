import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Undo2, MessageSquare, Star, TrendingUp } from 'lucide-react'

const kpis = [
  {
    icon: Undo2,
    iconColor: 'text-blue-500',
    title: 'Sparade avbokningar',
    value: '12',
    description: 'denna månad',
  },
  {
    icon: MessageSquare,
    iconColor: 'text-green-500',
    title: 'Meddelanden skickade',
    value: '156',
    description: 'denna månad',
  },
  {
    icon: Star,
    iconColor: 'text-yellow-500',
    title: 'Recensioner insamlade',
    value: '8',
    description: 'denna månad',
  },
  {
    icon: TrendingUp,
    iconColor: 'text-purple-500',
    title: 'Beräknade intäkter',
    value: '45 000 kr',
    description: 'tack vare LIFT',
  },
]

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Välkommen till LIFT</h1>
      <p className="text-muted-foreground">
        Här är en översikt av din AI-assistents aktivitet
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <Badge variant="secondary">Demo-data</Badge>
      </div>
    </div>
  )
}
