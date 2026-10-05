/** Over default cognitive threshold via nested branches. */
export function overCognitiveTs(x: number, y: number, z: number): number {
  if (x > 0) {
    if (y > 0) {
      if (z > 0) {
        if (x > 1) {
          if (y > 1) {
            if (z > 1) {
              if (x > 2) {
                if (y > 2) {
                  if (z > 2) {
                    if (x > 3) {
                      if (y > 3) {
                        if (z > 3) {
                          if (x > 4) {
                            if (y > 4) {
                              if (z > 4) {
                                return 1;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return 0;
}
