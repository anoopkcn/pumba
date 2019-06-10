import ascii from "rollup-plugin-ascii";
import node from "rollup-plugin-node-resolve";

export default [
  {
    onwarn: function(message) {
      if (message.code === 'CIRCULAR_DEPENDENCY') {
        return;
      }
      console.error(message);
    },
    input: "src/pumba",
    plugins: [
      node(),
      ascii()
    ],
    output: {
      extend: true,
      file: "build/dist/pumba.js",
      format: "umd",
      indent: false,
      name: "pumba"
    }
  }
];