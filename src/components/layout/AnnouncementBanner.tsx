import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';

interface AnnouncementBanner {
  text: string;
  link?: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  dismissible: boolean;
}

const SEVERITY_STYLE: Record<AnnouncementBanner['severity'], string> = {
  info: 'border-accent-200 bg-accent-50 text-accent-900 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-200',
  warning: 'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200',
  danger: 'border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200',
  success: 'border-success-200 bg-success-50 text-success-900 dark:border-success-900 dark:bg-success-950/40 dark:text-success-200',
};

/**
 * Global announcement banner. Reads from app_config on mount and shows if
 * there's a non-empty text. Users can dismiss if dismissible=true.
 * The dismissal is stored in announcement_dismissals table.
 */
export function AnnouncementBanner() {
  const [banner, setBanner] = useState<AnnouncementBanner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'announcement_banner')
        .maybeSingle();

      if (cancelled) return;

      if (!error && data?.value) {
        const b = data.value as AnnouncementBanner;
        if (b.text && b.text.trim()) {
          // Check if user has dismissed this banner version
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: dismissal } = await supabase
              .from('announcement_dismissals')
              .select('banner_id')
              .eq('user_id', user.id)
              .maybeSingle();
            if (dismissal) {
              setBanner(null);
              setLoading(false);
              return;
            }
          }
          setBanner(b);
        } else {
          setBanner(null);
        }
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading || !banner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 ${SEVERITY_STYLE[banner.severity]} px-4 py-2 animate-slide-down`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-content flex items-start justify-between gap-4">
        <div className="flex-1 text-body">
          {banner.text}
        </div>
        {banner.link && (
          <a
            href={banner.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 underline text-body hover:no-underline"
          >
            Learn more
          </a>
        )}
        {banner.dismissible && (
          <button
            type="button"
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase
                  .from('announcement_dismissals')
                  .upsert({ user_id: user.id, banner_id: banner.text.slice(0, 36) }); // use text prefix as pseudo-id
                setBanner(null);
              }
            }}
            className="shrink-0 p-1 rounded hover:bg-white/20"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}