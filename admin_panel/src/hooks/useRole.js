import useAdminInfo from "./useAdminInfo";

export default function useRole() {
  const { role } = useAdminInfo();
  return role;
}
