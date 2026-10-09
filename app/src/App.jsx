import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Database, ShieldCheck, CheckCircle2, 
  Layers, HardDrive, RefreshCw, Star, TrendingUp, Sparkles, Server
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const env = data?.env || 'Production';
  const isDev = env.toLowerCase() === 'dev';
  const products = data?.products || [];

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f19', color: '#f8fafc', padding: '24px 32px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', padding: '10px', borderRadius: '10px', display: 'flex' }}>
            <ShoppingBag size={28} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>AuroraStore Enterprise Portal</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Option 4: Web on EC2 + Amazon Relational Database Service (RDS Multi-AZ)</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ 
            background: isDev ? 'rgba(234, 179, 8, 0.15)' : 'rgba(236, 72, 153, 0.15)', 
            color: isDev ? '#eab308' : '#ec4899', 
            border: `1px solid ${isDev ? '#eab308' : '#ec4899'}`,
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
          }}>
            {env.toUpperCase()} ENVIRONMENT
          </span>

          <span style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={14} color="#ec4899" /> AWS Managed RDS MySQL
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        
        {/* Left Column: Product Catalog from RDS */}
        <div style={{ gridColumn: 'span 8' }}>
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#ec4899" />
                Live Product Catalog (Managed RDS Database)
              </h3>
              <span style={{ fontSize: '12px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '12px', border: '1px solid #10b981' }}>
                ● Automated Daily Backup & PITR
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {products.map((item) => (
                <div key={item.id} style={{ background: '#1f293d', border: '1px solid #374151', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                      {item.category}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#34d399' }}>${item.price}</span>
                  </div>
                  <h4 style={{ margin: '10px 0 6px 0', fontSize: '15px', color: '#f9fafb' }}>{item.name}</h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#9ca3af' }}>{item.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6b7280', borderTop: '1px solid #374151', paddingTop: '8px' }}>
                    <span>In Stock: {item.stock} units</span>
                    <span>SKU: {item.sku}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AWS RDS Enterprise Specs */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} color="#ec4899" />
              AWS Managed RDS Specification
            </h4>
            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.7' }}>
              <div><strong>Engine:</strong> MySQL Community 8.0.46</div>
              <div><strong>Instance Class:</strong> {isDev ? 'db.t3.micro (Dev)' : 'db.t4g.small (Prod)'}</div>
              <div><strong>Storage:</strong> 20 GB gp3 SSD (Auto-scaling)</div>
              <div><strong>Point-in-Time Recovery:</strong> 7-Day Window</div>
              <div><strong>Security:</strong> Private Subnets (2 AZ Multi-AZ ready)</div>
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#22c55e" />
              Production Grade SLA & RTO/RPO
            </h4>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.6' }}>
              <div>• <strong>RTO (Recovery Time):</strong> ~5 - 15 phút (Automated failover)</div>
              <div>• <strong>RPO (Data Loss Window):</strong> ~0 - 5 phút (WAL / Binary log streaming)</div>
              <div>• <strong>Maintenance Window:</strong> Tự động cập nhật bản vá bảo mật AWS</div>
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#f8fafc' }}>Domain & Edge Routing</h4>
            <div style={{ fontSize: '13px', color: '#ec4899', fontWeight: '600' }}>
              {isDev ? 'opt4-dev.png261.dev' : 'opt4.png261.dev'}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              Full TLS 1.3 Encryption & DDoS Shield
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
