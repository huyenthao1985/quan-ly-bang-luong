import React, { useState, useEffect } from "react";

interface Props {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  id?: string;
}

function fmt(n: number): string {
  if (isNaN(n) || n === 0) return "0";
  return n.toLocaleString("en-US");
}

export const FormattedNumberInput: React.FC<Props> = ({ value, onChange, className = "", placeholder, id }) => {
  const [display, setDisplay] = useState(() => fmt(value));

  useEffect(() => { setDisplay(fmt(value)); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = raw === "" ? 0 : Number(raw);
    setDisplay(raw === "" ? "" : num.toLocaleString("en-US"));
    onChange(num);
  };

  const handleBlur = () => { setDisplay(fmt(value)); };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};
