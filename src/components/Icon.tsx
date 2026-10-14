import { icon } from '../lib/icons.mjs';
/** SVG markup is an authored local constant, never article content. */
export default function Icon({ name }: { name: string }) { return <span data-icon={name} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon(name) }} />; }
