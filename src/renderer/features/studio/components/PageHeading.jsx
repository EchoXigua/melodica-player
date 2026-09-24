import { motion } from 'motion/react';
export function PageHeading({ enter }) {
  return (
    <motion.section className="page-heading mb-[22px]" {...enter()}>
      <h1 className="text-[27px] font-semibold tracking-[-1px] text-[#f3f2fa]">
        音乐工作台
        <span className="ml-[10px] text-[12px] font-normal tracking-normal text-[#74748d]">
          把旋律，变成现场。
        </span>
      </h1>
    </motion.section>
  );
}
