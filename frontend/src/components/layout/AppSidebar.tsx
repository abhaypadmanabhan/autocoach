"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Plus,
  FileText,
  Loader2,
  AlertCircle,
  Settings,
  Trash2,
} from "lucide-react";

import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { useToast } from "@/hooks/useToast";
import { groupDocumentsByDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useAvatar } from "@/hooks/useAvatar";
import { createBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Document } from "@/lib/types";

import { BrandMark } from "@/components/primitives-acx/BrandMark";
import { Kbd } from "@/components/primitives-acx/Kbd";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const groupOrder = [
  "Today",
  "Yesterday",
  "Previous 7 Days",
  "Previous 30 Days",
  "Older",
] as const;

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { documents, isLoading, error } = useDocuments();
  const { deleteDocument, deleting } = useDeleteDocument();
  const { showToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const { avatarUrl } = useAvatar(user?.id ?? null);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const initials =
    (user?.user_metadata?.display_name as string | undefined)?.slice(0, 2) ??
    user?.email?.slice(0, 2) ??
    "??";

  const sortedDocuments = [...documents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const grouped = groupDocumentsByDate(sortedDocuments);

  const activeDocId = pathname?.startsWith("/dashboard/")
    ? pathname.split("/")[2]
    : null;

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await deleteDocument(docToDelete.id);
      showToast("Document deleted", "success");
      setDocToDelete(null);
      if (activeDocId === docToDelete.id) router.push("/dashboard");
    } catch {
      showToast("Failed to delete document", "error");
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full bg-[var(--bg-base)] border-r border-[var(--line-subtle)]",
        className,
      )}
    >
      {/* Brand head */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-[var(--line-subtle)]">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2"
        >
          <BrandMark />
          <span className="font-display font-semibold uppercase tracking-[-0.01em]">AutoCoach</span>
        </Link>
      </div>

      {/* New document CTA */}
      <div className="px-3 py-3 border-b border-[var(--line-subtle)]">
        <Button
          variant="secondary"
          block
          asChild
          className="justify-between"
        >
          <Link href="/upload" onClick={onNavigate}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              New document
            </span>
            <Kbd>⌘N</Kbd>
          </Link>
        </Button>
      </div>

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-[var(--fg-tertiary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {error && (
          <div className="mx-2 p-2.5 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] text-[12px] text-[var(--danger)] flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>Failed to load documents</span>
          </div>
        )}
        {!isLoading && !error && sortedDocuments.length === 0 && (
          <div className="px-3 py-8 text-center text-[12px] text-[var(--fg-tertiary)]">
            No documents yet
          </div>
        )}
        {!isLoading && !error && sortedDocuments.length > 0 && (
          <div className="space-y-5 pt-1">
            {groupOrder
              .filter((group) => grouped[group]?.length)
              .map((group, groupIdx) => {
              const docs = grouped[group];
              return (
                <div key={group} className="space-y-0.5">
                  <h3 className="px-3 mb-1.5 kicker">
                    {String(groupIdx + 1).padStart(2, "0")} / {group}
                  </h3>
                  {docs.map((doc) => {
                    const isActive = activeDocId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "group relative flex items-center gap-2.5 px-2 py-1.5 mx-1 rounded-sm",
                          "text-[13px] transition-colors duration-[180ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                          isActive
                            ? "bg-[var(--bg-surface)] text-[var(--fg-primary)]"
                            : "text-[var(--fg-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-primary)]",
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)]" />
                        )}
                        <Link
                          href={`/dashboard/${doc.id}`}
                          onClick={onNavigate}
                          className="flex-1 flex items-center gap-2.5 min-w-0"
                          title={doc.ai_title ?? doc.filename}
                        >
                          <FileText
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              isActive
                                ? "text-[var(--fg-primary)]"
                                : "text-[var(--fg-tertiary)]",
                            )}
                          />
                          <span className="truncate">
                            {doc.ai_title ?? doc.filename}
                          </span>
                        </Link>
                        {doc.status === "processing" && (
                          <Loader2 className="h-3 w-3 text-[var(--warning)] animate-spin shrink-0" />
                        )}
                        {doc.status === "failed" && (
                          <AlertCircle className="h-3 w-3 text-[var(--danger)] shrink-0" />
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDocToDelete(doc);
                          }}
                          aria-label="Delete document"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[var(--fg-tertiary)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--line-subtle)] px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-sm hover:bg-[var(--bg-surface)] transition-colors">
              <Avatar className="h-[26px] w-[26px]">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] text-[var(--fg-primary)] truncate">
                  {(user?.user_metadata?.display_name as string | undefined) ??
                    user?.email ??
                    "Guest"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={onNavigate}>
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-[var(--danger)]">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={Boolean(docToDelete)}
        onOpenChange={(open) => !open && setDocToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {docToDelete && (
                <>
                  {`"${docToDelete.ai_title ?? docToDelete.filename}" will be permanently removed, including all sessions and concepts.`}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="!bg-transparent !text-[var(--danger)] !shadow-none !border-2 !border-[var(--danger)] hover:!bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] active:!translate-x-0 active:!translate-y-[1px]"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
