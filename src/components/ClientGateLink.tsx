'use client';

interface ClientGateLinkProps {
  url: string;
  children: React.ReactNode;
  className?: string;
}

export function ClientGateLink({ url, children, className }: ClientGateLinkProps) {
  const handleOpen = () => {
    const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-fba885359a4d40d6bd6e89575d51f9ca.r2.dev';
    let fullUrl = url.startsWith('http') 
      ? url 
      : `${r2Base}/${url}`;
    fullUrl = encodeURI(fullUrl);
    window.open(fullUrl, '_blank');
  };

  return (
    <div className={className} onClick={handleOpen} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  );
}
