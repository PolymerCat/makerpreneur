import { CourseProvider } from "./_lib/CourseProvider";

export default function StudyLayout(props: { children: React.ReactNode }) {
  return <CourseProvider>{props.children}</CourseProvider>;
}
