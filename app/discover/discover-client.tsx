"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DiscoverPost = {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
};

type DiscoverClientProps = {
  currentUserName: string;
  currentUserId: string;
};

const seedPosts: DiscoverPost[] = [
  {
    id: "p1",
    authorName: "Jamie Rivera",
    authorId: "HH-1027",
    text: "Sunset harbor walk and good coffee. Looking for someone who enjoys slow conversations.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD70KUzI_tc0toOvO-mC2Z0GuTs9ONDcR2trbBwGdtTrmkZK9OsfjnE05TGwVAVFZrZho41Mt4YEML1Q33i_2mvKqiPnx3ne-X3rlsivF-04oke2A3bk8xSprdsfx70HELlGcRf6fuIc-jvY09dMfMnjMTT-mmUoshS99IFc707HYsEaui9RDqjEXWaO6_AXq0BbX8CwQiKoedq-a6qgji4jzjO6u_mwcURq_hbhs8ckVMjwKIbAG1iX5lvIfhcdKKg4iCkDQoNFcDb",
    createdAt: "2h ago"
  },
  {
    id: "p2",
    authorName: "Morgan Lee",
    authorId: "HH-2284",
    text: "Bookstore morning and a late brunch. Who else likes simple weekends?",
    createdAt: "4h ago"
  }
];

const DISCOVER_POSTS_BUCKET = "discover-posts";

function createUserPostId() {
  return `p-${Date.now()}`;
}

export function DiscoverClient({ currentUserName, currentUserId }: DiscoverClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [thoughtText, setThoughtText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [posts, setPosts] = useState<DiscoverPost[]>(seedPosts);

  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return posts;
    }
    return posts.filter(
      (post) =>
        post.authorName.toLowerCase().includes(normalized) || post.authorId.toLowerCase().includes(normalized)
    );
  }, [posts, query]);

  async function onCreatePost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPosting(true);
    setFormMessage(null);

    const text = thoughtText.trim();
    if (!text && !selectedFile) {
      setFormMessage("Add a thought or select a photo before posting.");
      setPosting(false);
      return;
    }

    let uploadedImageUrl: string | undefined;
    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filePath = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(DISCOVER_POSTS_BUCKET)
        .upload(filePath, selectedFile, { upsert: false });

      if (uploadError) {
        setFormMessage(
          `Image upload failed. Create a public Supabase bucket named "${DISCOVER_POSTS_BUCKET}" and try again.`
        );
        setPosting(false);
        return;
      }

      const {
        data: { publicUrl }
      } = supabase.storage.from(DISCOVER_POSTS_BUCKET).getPublicUrl(filePath);
      uploadedImageUrl = publicUrl;
    }

    const nextPost: DiscoverPost = {
      id: createUserPostId(),
      authorName: currentUserName,
      authorId: currentUserId,
      text,
      imageUrl: uploadedImageUrl,
      createdAt: "Just now"
    };

    setPosts((prev) => [nextPost, ...prev]);
    setThoughtText("");
    setSelectedFile(null);
    setFormMessage("Posted to Discover.");
    setPosting(false);
  }

  return (
    <div className="-mx-4 min-h-[calc(100vh-80px)] bg-[#f8f7f6] px-4 md:-mx-8 md:px-8">
      <div className="mx-auto max-w-[1320px] py-6">
        <main className="space-y-6">
          <header className="rounded-3xl border border-[#ee9d2b]/10 bg-white/80 p-5 backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-[#6a738a]">Find meaningful posts from the community.</p>
              </div>
              <div className="relative w-full md:max-w-sm">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a94aa]">
                  ⌕
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or user ID"
                  className="w-full rounded-full border border-[#e5e7ef] bg-white py-3 pl-11 pr-4 text-sm text-[#1f273f] outline-none ring-[#ee9d2b]/40 focus:ring-2"
                />
              </div>
            </div>
          </header>

          <section className="rounded-3xl border border-[#ee9d2b]/10 bg-white p-5">
            <h2 className="text-lg font-bold text-[#1e2740]">Share your thoughts</h2>
            <p className="mt-1 text-sm text-[#6a738a]">Post daily life updates or a photo for others to discover.</p>
            <form className="mt-4 space-y-3" onSubmit={onCreatePost}>
              <textarea
                value={thoughtText}
                onChange={(e) => setThoughtText(e.target.value)}
                placeholder="What are you thinking today?"
                className="min-h-24 w-full rounded-2xl border border-[#e5e7ef] bg-[#fcfcfd] px-4 py-3 text-sm text-[#1f273f] outline-none ring-[#ee9d2b]/40 focus:ring-2"
              />
              <label className="block rounded-2xl border border-[#e5e7ef] bg-[#fcfcfd] px-4 py-3 text-sm text-[#1f273f]">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8a94aa]">
                  Upload Daily Photo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#ee9d2b]/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#b7700f]"
                />
              </label>
              <button
                type="submit"
                disabled={posting}
                className="inline-flex items-center rounded-full bg-[#ee9d2b] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95"
              >
                {posting ? "Posting..." : "Post to Discover"}
              </button>
              {formMessage && <p className="text-sm text-[#6a738a]">{formMessage}</p>}
            </form>
          </section>

          <section className="space-y-4">
            {filteredPosts.length === 0 ? (
              <div className="rounded-3xl border border-[#ee9d2b]/10 bg-white p-8 text-center">
                <p className="text-sm text-[#6a738a]">No users found for this name or ID search.</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <article key={post.id} className="overflow-hidden rounded-3xl border border-[#ee9d2b]/10 bg-white">
                  <div className="p-5">
                    <p className="text-base font-bold text-[#1e2740]">{post.authorName}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-[#8a94aa]">
                      {post.authorId} • {post.createdAt}
                    </p>
                    {post.text && <p className="mt-3 text-sm leading-7 text-[#4f5870]">{post.text}</p>}
                  </div>
                  {post.imageUrl && (
                    <img src={post.imageUrl} alt={`${post.authorName} post`} className="h-[340px] w-full object-cover" />
                  )}
                </article>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
