"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Members moved into Settings (admins only); keep old links working.
export default function MembersRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/settings"); }, [router]);
  return null;
}
