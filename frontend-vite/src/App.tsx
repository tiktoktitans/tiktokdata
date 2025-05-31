// src/App.tsx (or wherever your VideoCard lives)
import React, { useState, Fragment } from "react";
import { Dialog, Transition, Tab } from "@headlessui/react";
import { XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { useVideos } from "./hooks/useVideos";
import type { Video, FilterValues } from "./hooks/useVideos";

export default function App() {
  const [filters, setFilters] = useState<FilterValues>({
    startDate: null,
    productId: null,
    postedWithin: "any",
    adType: "all",
    gender: "all",
    sortBy: "view_growth",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Now returns rows with thumbnail_url & product_image
  const { videos, loading, error } = useVideos(filters);

  // Example product list for the dropdown (you can fetch this from Supabase later)
  const products = [
    { id: "prod_1", name: "Apple Cider Gummies" },
    { id: "prod_2", name: "Oregano Oil Softgels" },
    { id: "prod_3", name: "LED Night Lamp" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-pageBg text-primary">
      {/* — Mobile Filter Drawer (unchanged) — */}
      <Transition.Root show={showFilters} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50 md:hidden"
          onClose={setShowFilters}
        >
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-40" />
          </Transition.Child>
          <div className="fixed inset-0 flex z-50">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="relative ml-auto w-full max-w-xs h-full bg-cardBg text-primary shadow-xl py-4 overflow-y-auto">
                <div className="px-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-2 rounded-full hover:bg-gray-800 focus:outline-none"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <div className="mt-4 divide-y divide-borderColor">
                  <FilterSidebar
                    products={products}
                    onChange={setFilters}
                  />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* — Navbar + Desktop Filters (unchanged) — */}
      <nav className="sticky top-0 z-40 bg-pageBg border-b border-borderColor">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">THE DAILY VIRALS</h1>
          <div className="hidden md:flex space-x-6 items-center">
            {/* “Show Since” DatePicker */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-secondary">
                Show Since
              </label>
              <DatePicker
                selected={filters.startDate}
                onChange={(date) =>
                  setFilters((prev) => ({
                    ...prev,
                    startDate: date,
                  }))
                }
                placeholderText="Select date"
                className="w-full py-2 px-3 bg-cardBg border border-borderColor rounded-md text-primary text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {/* “Product” dropdown */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-secondary">
                Product
              </label>
              <select
                value={filters.productId ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    productId: e.target.value || null,
                  }))
                }
                className="w-full py-2 px-3 bg-cardBg border border-borderColor rounded-md text-primary text-sm focus:outline-none focus:border-accent"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* “Posted Within” tabs */}
            <div>
              <label className="text-sm font-medium text-secondary">
                Posted Within
              </label>
              <Tab.Group
                selectedIndex={["any", "1", "3", "5"].indexOf(
                  filters.postedWithin
                )}
                onChange={(i: number) => {
                  const map = (["any", "1", "3", "5"] as const)[i];
                  setFilters((prev) => ({
                    ...prev,
                    postedWithin: map,
                  }));
                }}
              >
                <Tab.List className="flex space-x-1 bg-gray-800 p-1 rounded-md">
                  {["Any", "1 Day", "3 Days", "5 Days"].map(
                    (label, _i /* unused */) => (
                      <Tab
                        key={label}
                        className={({ selected }) =>
                          `flex-1 py-2 text-xs font-medium text-center rounded-md ${
                            selected
                              ? "bg-accent text-pageBg"
                              : "text-secondary hover:bg-gray-700"
                          }`
                        }
                      >
                        {label}
                      </Tab>
                    )
                  )}
                </Tab.List>
              </Tab.Group>
            </div>
          </div>

          {/* Mobile “Filter Videos” button */}
          <button
            onClick={() => setShowFilters(true)}
            className="md:hidden px-4 py-2 bg-accent text-pageBg text-sm font-medium rounded-md hover:bg-orange-500 focus:outline-none"
          >
            Filter Videos
            <ChevronDownIcon className="inline h-5 w-5 ml-1" />
          </button>
        </div>
      </nav>

      {/* — Video Grid — */}
      <main className="flex-1 bg-pageBg px-4 sm:px-6 lg:px-8 py-6">
        {loading && (
          <div className="text-center text-secondary">
            Loading videos…
          </div>
        )}
        {error && (
          <div className="text-center text-red-500">
            Error: {error}
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="text-center text-secondary">
            No videos found.
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video, i) => (
              <VideoCard
                key={video.aweme_id}
                video={video}
                rank={i + 1}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

//
// ─────── FilterSidebar Component ───────
// (unchanged from before; it just calls onChange(filters) whenever a control changes)
//
interface FilterSidebarProps {
  products: { id: string; name: string }[];
  onChange: (filters: FilterValues) => void;
}

function FilterSidebar({
  products,
  onChange,
}: FilterSidebarProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [postedWithin, setPostedWithin] =
    useState<"any" | "1" | "3" | "5">("any");
  const [adType, setAdType] =
    useState<"all" | "organic" | "ad">("all");
  const [gender, setGender] =
    useState<"all" | "male" | "female" | "other">("all");
  const [sortBy, setSortBy] = useState<
    "view_growth" | "total_views" | "new_comments"
  >("view_growth");

  React.useEffect(() => {
    onChange({
      startDate,
      productId,
      postedWithin,
      adType,
      gender,
      sortBy,
    });
  }, [
    startDate,
    productId,
    postedWithin,
    adType,
    gender,
    sortBy,
    onChange,
  ]);

  const sharedInputClasses =
    "block w-full py-2 px-3 bg-cardBg border border-borderColor rounded-md text-primary text-sm focus:outline-none focus:border-accent";

  return (
    <div className="space-y-6 p-4">
      {/* 1) Show Since */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Show Since
        </label>
        <DatePicker
          selected={startDate}
          onChange={(date) => setStartDate(date)}
          placeholderText="Select date"
          className={sharedInputClasses}
        />
      </div>

      {/* 2) Product */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Product
        </label>
        <select
          value={productId ?? ""}
          onChange={(e) => setProductId(e.target.value || null)}
          className={sharedInputClasses}
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3) Posted Within */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Posted Within
        </label>
        <Tab.Group
          selectedIndex={["any", "1", "3", "5"].indexOf(
            postedWithin
          )}
          onChange={(i: number) => {
            const map = (["any", "1", "3", "5"] as const)[i];
            setPostedWithin(map);
          }}
        >
          <Tab.List className="flex space-x-1 bg-gray-800 p-1 rounded-md">
            {["Any", "1 Day", "3 Days", "5 Days"].map(
              (label, _i /* unused */) => (
                <Tab
                  key={label}
                  className={({ selected }) =>
                    `flex-1 py-2 text-xs font-medium text-center rounded-md ${
                      selected
                        ? "bg-accent text-pageBg"
                        : "text-secondary hover:bg-gray-700"
                    }`
                  }
                >
                  {label}
                </Tab>
              )
            )}
          </Tab.List>
        </Tab.Group>
      </div>

      {/* 4) Ad Type */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Ad Type
        </label>
        <select
          value={adType}
          onChange={(e) => setAdType(e.target.value as any)}
          className={sharedInputClasses}
        >
          <option value="all">All</option>
          <option value="organic">Organic</option>
          <option value="ad">Ad</option>
        </select>
      </div>

      {/* 5) Gender */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Gender
        </label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as any)}
          className={sharedInputClasses}
        >
          <option value="all">All</option>
          <option value="male">Male‐leaning</option>
          <option value="female">Female‐leaning</option>
          <option value="other">Unclear</option>
        </select>
      </div>

      {/* 6) Sort By */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Sort By
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className={sharedInputClasses}
        >
          <option value="view_growth">View Growth</option>
          <option value="total_views">Total Views</option>
          <option value="new_comments">New Comments</option>
        </select>
      </div>
    </div>
  );
}

//
// ─────── VideoCard Component ───────
// This now uses `thumbnail_url` and `product_image` (exact column names).
//
function VideoCard({
  video,
  rank,
}: {
  video: Video;
  rank: number;
}) {
  return (
    <div className="bg-cardBg rounded-lg overflow-hidden flex flex-col">
      {/* ── Render the video thumbnail using “thumbnail_url” ── */}
      <div className="relative">
        <div className="absolute top-2 left-2 bg-accent text-pageBg rounded-full px-2 py-1 text-xs font-semibold">
          #{rank} +{video.likes.toLocaleString()} views
        </div>
        <div className="aspect-video">
          <img
            src={video.thumbnail_url ?? ""}
            alt={video.caption ?? "Video thumbnail"}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* ── Caption + Product Image (if available) ── */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm mb-2 flex-1">{video.caption}</p>

        {/* Now render the actual product image from Supabase */}
        {video.product_image && (
          <div className="mb-3">
            <img
              src={video.product_image}
              alt={video.product_name ?? "Product Image"}
              className="w-full h-40 object-cover rounded"
            />
          </div>
        )}

        {/* ── Stats Row ── */}
        <div className="flex justify-between text-xs text-secondary mb-3">
          <span>❤️ {video.likes.toLocaleString()}</span>
          <span>💬 {video.comments.toLocaleString()}</span>
          <span>🔄 {video.shares.toLocaleString()}</span>
        </div>

        {/* ── “Save Product” button if there’s a product name ── */}
        {video.product_name && (
          <button className="mt-auto py-2 bg-accent text-pageBg text-sm font-medium rounded-md hover:bg-orange-500">
            {video.product_name} (${video.price})
          </button>
        )}
      </div>
    </div>
  );
}
