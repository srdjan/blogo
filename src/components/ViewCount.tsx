// Eye icon SVG component
const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ViewCount = (props: { readonly count?: number | undefined }) => {
  const { count } = props;

  if (count === undefined) {
    return null;
  }

  return (
    <span class="post-views" aria-label={`${count} views`}>
      <EyeIcon />
      <span class="view-count">{count}</span>
    </span>
  );
};
