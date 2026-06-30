import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="text-gray-500">Page Not Found</p>

      <Link
        to="/"
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  );
}