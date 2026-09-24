import { motion } from 'motion/react';
export function IconButton({ label, children, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      className="icon-button inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] text-[#9393a7] [background:none]"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </motion.button>
  );
}
