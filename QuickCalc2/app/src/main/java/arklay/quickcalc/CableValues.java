package arklay.quickcalc;


import java.math.BigDecimal;
import java.math.MathContext;

//int x is the AWG with any / removed,Y is 0 if unshielded 1 if shielded,
// t is zero for portable power cables, t is one for mine power feeder cables.
    //KV tells us the voltage class.
//Computes the impedance values for cables based on four parameters.
    //All cables assumed to be 90C cables.
public  class CableValues {

     public static Complex impedance(int x,int y,int t,int KV,double Distance)//X for size, Y for Shielded, T for Type.
    {
        Double real=0.0;
        Double imag=0.0;

        if (x==8 && y==0 && t==0 && KV==2) {
            real =.838;
            imag=.034;
        }
        else if (x==7 && y==0 && t==0 && KV==2) {
            real =.696;
            imag=.033;
        }
        else if (x==6 && y==0 && t==0 && KV==2) {
            real =.552;
            imag=.032;
        }
        else if (x==5 && y==0 && t==0 && KV==2) {
            real =.438;
            imag=.031;
        }
        else if (x==4 && y==0 && t==0 && KV==2) {
            real =.347;
            imag=.031;
        }
        else if (x==3 && y==0 && t==0 && KV==2) {
            real =.275;
            imag=.031;
        }
        else if (x==2 && y==0 && t==0 && KV==2) {
            real =.218;
            imag=.029;
        }
        else if (x==1 && y==0 && t==0 && KV==2) {
            real =.173;
            imag=.030;
        }
        else if (x==10 && y==0 && t==0 && KV==2) {
            real =.134;
            imag=.029;
        }
        else if (x==20 && y==0 && t==0 && KV==2) {
            real =.107;
            imag=.029;
        }
        else if (x==30 && y==0 && t==0 && KV==2) {
            real =.085;
            imag=.028;
        }
        else if (x==40 && y==0 && t==0 && KV==2) {
            real =.068;
            imag=.027;
        }
        else if (x==250 && y==0 && t==0 && KV==2) {
            real =.057;
            imag=.028;
        }
        else if (x==300 && y==0 && t==0 && KV==2) {
            real =.048;
            imag=.027;
        }
        else if (x==350 && y==0 && t==0 && KV==2) {
            real =.041;
            imag=.027;
        }
        else if (x==400 && y==0 && t==0 && KV==2) {
            real =.036;
            imag=.027;
        }
        else if (x==500 && y==0 && t==0 && KV==2) {
            real =.029;
            imag=.026;
        }
        else if (x==600 && y==0 && t==0 && KV==2) {
            real =.024;
            imag=.026;
        }
        else if (x==700 && y==0 && t==0 && KV==2) {
            real =.021;
            imag=.026;
        }

        else if (x==800 && y==0 && t==0 && KV==2) {
            real =.019;
            imag=.025;
        }
        else if (x==900 && y==0 && t==0 && KV==2) {
            real =.017;
            imag=.025;
        }
        else if (x==1000 && y==0 && t==0 && KV==2) {
            real =.015;
            imag=.025;
        } //End of 2KV Unshielded.


        else if (x==6 && y==1 && t==0 && KV==2) {
            real =.552;
            imag=.038;
        }
        else if (x==5 && y==1 && t==0 && KV==2) {
            real =.438;
            imag=.036;
        }
        else if (x==4 && y==1 && t==0 && KV==2) {
            real =.347;
            imag=.035;
        }
        else if (x==3 && y==1 && t==0 && KV==2) {
            real =.275;
            imag=.034;
        }
        else if (x==2 && y==1 && t==0 && KV==2) {
            real =.218;
            imag=.033;
        }
        else if (x==1 && y==1 && t==0 && KV==2) {
            real =.173;
            imag=.033;
        }
        else if (x==10 && y==1 && t==0 && KV==2) {
            real =.134;
            imag=.032;
        }
        else if (x==20 && y==1 && t==0 && KV==2) {
            real =.107;
            imag=.031;
        }
        else if (x==30 && y==1 && t==0 && KV==2) {
            real =.085;
            imag=.030;
        }
        else if (x==40 && y==1 && t==0 && KV==2) {
            real =.068;
            imag=.029;
        }
        else if (x==250 && y==1 && t==0 && KV==2) {
            real =.057;
            imag=.030;
        }
        else if (x==300 && y==1 && t==0 && KV==2) {
            real =.048;
            imag=.029;
        }
        else if (x==350 && y==1 && t==0 && KV==2) {
            real =.041;
            imag=.029;
        }
        else if (x==400 && y==1 && t==0 && KV==2) {
            real =.036;
            imag=.028;
        }
        else if (x==500 && y==1 && t==0 && KV==2) {
            real =.029;
            imag=.028;
        }
        else if (x==600 && y==1 && t==0 && KV==2) {
            real =.024;
            imag=.027;
        }
        else if (x==700 && y==1 && t==0 && KV==2) {
            real =.021;
            imag=.027;
        }

        else if (x==800 && y==1 && t==0 && KV==2) {
            real =.019;
            imag=.026;
        }
        else if (x==900 && y==1 && t==0 && KV==2) {
            real =.017;
            imag=.026;
        }
        else if (x==1000 && y==1 && t==0 && KV==2) {
            real =.015;
            imag=.026;
        } //End of 2KV shielded.
    //Beginning of 5KV shielded.
        else if (x==6 && y==1 && t==0 && KV==5) {
            real =.552;
            imag=.043;
        }
        else if (x==5 && y==1 && t==0 && KV==5) {
            real =.438;
            imag=.042;
        }
        else if (x==4 && y==1 && t==0 && KV==5) {
            real =.347;
            imag=.040;
        }
        else if (x==3 && y==1 && t==0 && KV==5) {
            real =.275;
            imag=.039;
        }
        else if (x==2 && y==1 && t==0 && KV==5) {
            real =.218;
            imag=.038;
        }
        else if (x==1 && y==1 && t==0 && KV==5) {
            real =.173;
            imag=.036;
        }
        else if (x==10 && y==1 && t==0 && KV==5) {
            real =.134;
            imag=.035;
        }
        else if (x==20 && y==1 && t==0 && KV==5) {
            real =.107;
            imag=.034;
        }
        else if (x==30 && y==1 && t==0 && KV==5) {
            real =.085;
            imag=.033;
        }
        else if (x==40 && y==1 && t==0 && KV==5) {
            real =.068;
            imag=.032;
        }
        else if (x==250 && y==1 && t==0 && KV==5) {
            real =.057;
            imag=.031;
        }
        else if (x==300 && y==1 && t==0 && KV==5) {
            real =.048;
            imag=.031;
        }
        else if (x==350 && y==1 && t==0 && KV==5) {
            real =.041;
            imag=.030;
        }
        else if (x==400 && y==1 && t==0 && KV==5) {
            real =.036;
            imag=.030;
        }
        else if (x==500 && y==1 && t==0 && KV==5) {
            real =.029;
            imag=.029;
        }
        else if (x==600 && y==1 && t==0 && KV==5) {
            real =.024;
            imag=.028;
        }
        else if (x==700 && y==1 && t==0 && KV==5) {
            real =.021;
            imag=.028;
        }

        else if (x==800 && y==1 && t==0 && KV==5) {
            real =.019;
            imag=.028;
        }
        else if (x==900 && y==1 && t==0 && KV==5) {
            real =.017;
            imag=.027;
        }
        else if (x==1000 && y==1 && t==0 && KV==5) {
            real =.015;
            imag=.027;
        } //End of 5KV shielded.
        //Beginning of 8KV shielded.
        else if (x==4 && y==1 && t==0 && KV==8) {
            real =.347;
            imag=.043;
        }
        else if (x==3 && y==1 && t==0 && KV==8) {
            real =.275;
            imag=.042;
        }
        else if (x==2 && y==1 && t==0 && KV==8) {
            real =.218;
            imag=.040;
        }
        else if (x==1 && y==1 && t==0 && KV==8) {
            real =.173;
            imag=.039;
        }
        else if (x==10 && y==1 && t==0 && KV==8) {
            real =.134;
            imag=.037;
        }
        else if (x==20 && y==1 && t==0 && KV==8) {
            real =.107;
            imag=.036;
        }
        else if (x==30 && y==1 && t==0 && KV==8) {
            real =.085;
            imag=.035;
        }
        else if (x==40 && y==1 && t==0 && KV==8) {
            real =.068;
            imag=.034;
        }
        else if (x==250 && y==1 && t==0 && KV==8) {
            real =.057;
            imag=.033;
        }
        else if (x==300 && y==1 && t==0 && KV==8) {
            real =.048;
            imag=.032;
        }
        else if (x==350 && y==1 && t==0 && KV==8) {
            real =.041;
            imag=.032;
        }
        else if (x==400 && y==1 && t==0 && KV==8) {
            real =.036;
            imag=.031;
        }
        else if (x==500 && y==1 && t==0 && KV==8) {
            real =.029;
            imag=.030;
        }
        else if (x==600 && y==1 && t==0 && KV==8) {
            real =.024;
            imag=.030;
        }
        else if (x==700 && y==1 && t==0 && KV==8) {
            real =.021;
            imag=.029;
        }

        else if (x==800 && y==1 && t==0 && KV==8) {
            real =.019;
            imag=.029;
        }
        else if (x==900 && y==1 && t==0 && KV==8) {
            real =.017;
            imag=.028;
        }
        else if (x==1000 && y==1 && t==0 && KV==8) {
            real =.015;
            imag=.028;
        } //End of 8KV shielded.
        //Beginning of 15KV Shielded.
        else if (x==2 && y==1 && t==0 && KV==15) {
            real =.218;
            imag=.044;
        }
        else if (x==1 && y==1 && t==0 && KV==15) {
            real =.173;
            imag=.042;
        }
        else if (x==10 && y==1 && t==0 && KV==15) {
            real =.134;
            imag=.040;
        }
        else if (x==20 && y==1 && t==0 && KV==15) {
            real =.107;
            imag=.039;
        }
        else if (x==30 && y==1 && t==0 && KV==15) {
            real =.085;
            imag=.038;
        }
        else if (x==40 && y==1 && t==0 && KV==15) {
            real =.068;
            imag=.036;
        }
        else if (x==250 && y==1 && t==0 && KV==15) {
            real =.057;
            imag=.036;
        }
        else if (x==300 && y==1 && t==0 && KV==15) {
            real =.048;
            imag=.035;
        }
        else if (x==350 && y==1 && t==0 && KV==15) {
            real =.041;
            imag=.034;
        }
        else if (x==400 && y==1 && t==0 && KV==15) {
            real =.036;
            imag=.033;
        }
        else if (x==500 && y==1 && t==0 && KV==15) {
            real =.029;
            imag=.032;
        }
        else if (x==600 && y==1 && t==0 && KV==15) {
            real =.024;
            imag=.032;
        }
        else if (x==700 && y==1 && t==0 && KV==15) {
            real =.021;
            imag=.031;
        }

        else if (x==800 && y==1 && t==0 && KV==15) {
            real =.019;
            imag=.030;
        }
        else if (x==900 && y==1 && t==0 && KV==15) {
            real =.017;
            imag=.030;
        }
        else if (x==1000 && y==1 && t==0 && KV==15) {
            real =.015;
            imag=.030;
        } //End of 15KV shielded.
        //Beginning of 25KV Shielded.

        else if (x==1 && y==1 && t==0 && KV==25) {
            real =.173;
            imag=.046;
        }
        else if (x==10 && y==1 && t==0 && KV==25) {
            real =.134;
            imag=.044;
        }
        else if (x==20 && y==1 && t==0 && KV==25) {
            real =.107;
            imag=.043;
        }
        else if (x==30 && y==1 && t==0 && KV==25) {
            real =.085;
            imag=.041;
        }
        else if (x==40 && y==1 && t==0 && KV==25) {
            real =.068;
            imag=.040;
        }
        else if (x==250 && y==1 && t==0 && KV==25) {
            real =.057;
            imag=.039;
        }
        else if (x==300 && y==1 && t==0 && KV==25) {
            real =.048;
            imag=.038;
        }
        else if (x==350 && y==1 && t==0 && KV==25) {
            real =.041;
            imag=.037;
        }
        else if (x==400 && y==1 && t==0 && KV==25) {
            real =.036;
            imag=.036;
        }
        else if (x==500 && y==1 && t==0 && KV==25) {
            real =.029;
            imag=.035;
        }
        else if (x==600 && y==1 && t==0 && KV==25) {
            real =.024;
            imag=.034;
        }
        else if (x==700 && y==1 && t==0 && KV==25) {
            real =.021;
            imag=.033;
        }

        else if (x==800 && y==1 && t==0 && KV==25) {
            real =.019;
            imag=.033;
        }
        else if (x==900 && y==1 && t==0 && KV==25) {
            real =.017;
            imag=.032;
        }
        else if (x==1000 && y==1 && t==0 && KV==25) {
            real =.015;
            imag=.032;
        } //End of 25KV shielded.
        //End og Portable Power Cables, Now we begin Mine Power Feeder Cables.
        //
        if (t==1 && y ==1) //If Type if Power Feeder Cables,
        {
            if (x==6 && KV ==5)
            {
                real=.510;
                imag=.041;
            }
            else if (x==5 && KV==5)
            {
                real=.404;
                imag=.40;
            }
            else if (x==4 && KV==5)
            {
                real=.321;
                imag=.038;
            }
            else if (x==3 && KV==5)
            {
                real=.254;
                imag=.037;
            }
            else if (x==2 && KV==5)
            {
                real=.201;
                imag=.036;
            }
            else if (x==1 && KV==5)
            {
                real=.160;
                imag=.035;
            }
            else if (x==10 && KV==5)
            {
                real=.127;
                imag=.034;
            }
            else if (x==20 && KV==5)
            {
                real=.101;
                imag=.033;
            }
            else if (x==30 && KV==5)
            {
                real=.080;
                imag=.032;
            }
            else if (x==40 && KV==5)
            {
                real=.063;
                imag=.031;
            }
            else if (x==250 && KV==5)
            {
                real = .054;
                imag= .030;
            }
            else if (x==300 && KV==5)
            {
                real=.045;
                imag=.029;
            }
            else if (x==350 && KV==5)
            {
                real=.039;
                imag=.029;
            }
            else if (x==400 && KV==5)
            {
                real=.034;
                imag=.029;
            }
            else if (x==500 && KV==5)
            {
                real=.027;
                imag=.028;
            }
            else if (x==600 && KV==5)
            {
                real =.023;
                imag=.028;
            }
            else if (x==700 && KV==5)
            {
                real=.020;
                imag=.027;
            }
            else if (x==800 && KV==5)
            {
                real=.017;
                imag=.027;
            }
            else if (x==900 && KV==5)
            {
                real=.016;
                imag=.027;
            }
            else if (x==1000 && KV==5)
            {
                real=.014;
                imag=.026;
            }
            if (x==6 && KV ==5)
            {
                real=.510;
                imag=.041;
            }
            else if (x==5 && KV==5)
            {
                real=.404;
                imag=.40;
            }
            else if (x==4 && KV==5)
            {
                real=.321;
                imag=.038;
            }
            else if (x==3 && KV==5)
            {
                real=.254;
                imag=.037;
            }
            else if (x==2 && KV==5)
            {
                real=.201;
                imag=.036;
            }
            else if (x==1 && KV==5)
            {
                real=.160;
                imag=.035;
            }
            else if (x==10 && KV==5)
            {
                real=.127;
                imag=.034;
            }
            else if (x==20 && KV==5)
            {
                real=.101;
                imag=.033;
            }
            else if (x==30 && KV==5)
            {
                real=.080;
                imag=.032;
            }
            else if (x==40 && KV==5)
            {
                real=.063;
                imag=.031;
            }
            else if (x==250 && KV==5)
            {
                real = .054;
                imag= .030;
            }
            else if (x==300 && KV==5)
            {
                real=.045;
                imag=.029;
            }
            else if (x==350 && KV==5)
            {
                real=.039;
                imag=.029;
            }
            else if (x==400 && KV==5)
            {
                real=.034;
                imag=.029;
            }
            else if (x==500 && KV==5)
            {
                real=.027;
                imag=.028;
            }
            else if (x==600 && KV==5)
            {
                real =.023;
                imag=.028;
            }
            else if (x==700 && KV==5)
            {
                real=.020;
                imag=.027;
            }
            else if (x==800 && KV==5)
            {
                real=.017;
                imag=.027;
            }
            else if (x==900 && KV==5)
            {
                real=.016;
                imag=.027;
            }
            else if (x==1000 && KV==5)
            {
                real=.014;
                imag=.026;
            }
            //End of Power Feeder 5KV Cables.
            else if (x==6 && KV ==8)
            {
                real=.510;
                imag=.044;
            }
            else if (x==5 && KV==8)
            {
                real=.404;
                imag=.42;
            }
            else if (x==4 && KV==8)
            {
                real=.321;
                imag=.041;
            }
            else if (x==3 && KV==8)
            {
                real=.254;
                imag=.039;
            }
            else if (x==2 && KV==8)
            {
                real=.201;
                imag=.038;
            }
            else if (x==1 && KV==8)
            {
                real=.160;
                imag=.037;
            }
            else if (x==10 && KV==8)
            {
                real=.127;
                imag=.035;
            }
            else if (x==20 && KV==8)
            {
                real=.101;
                imag=.034;
            }
            else if (x==30 && KV==8)
            {
                real=.080;
                imag=.033;
            }
            else if (x==40 && KV==8)
            {
                real=.063;
                imag=.032;
            }
            else if (x==250 && KV==8)
            {
                real = .054;
                imag= .031;
            }
            else if (x==300 && KV==8)
            {
                real=.045;
                imag=.031;
            }
            else if (x==350 && KV==8)
            {
                real=.039;
                imag=.030;
            }
            else if (x==400 && KV==8)
            {
                real=.034;
                imag=.030;
            }
            else if (x==500 && KV==8)
            {
                real=.027;
                imag=.029;
            }
            else if (x==600 && KV==8)
            {
                real =.023;
                imag=.029;
            }
            else if (x==700 && KV==8)
            {
                real=.020;
                imag=.028;
            }
            else if (x==800 && KV==8)
            {
                real=.017;
                imag=.028;
            }
            else if (x==900 && KV==8)
            {
                real=.016;
                imag=.027;
            }
            else if (x==1000 && KV==8)
            {
                real=.014;
                imag=.027;
            }
            //END of Mine Power Feeder Cables 8KV.
            //Begining of Mine Power Feeder Cables 15KV.

            else if (x==2 && KV==15)
            {
                real=.201;
                imag=.042;
            }
            else if (x==1 && KV==15)
            {
                real=.160;
                imag=.041;
            }
            else if (x==10 && KV==15)
            {
                real=.127;
                imag=.039;
            }
            else if (x==20 && KV==15)
            {
                real=.101;
                imag=.038;
            }
            else if (x==30 && KV==15)
            {
                real=.080;
                imag=.036;
            }
            else if (x==40 && KV==15)
            {
                real=.063;
                imag=.035;
            }
            else if (x==250 && KV==15)
            {
                real = .054;
                imag= .034;
            }
            else if (x==300 && KV==15)
            {
                real=.045;
                imag=.034;
            }
            else if (x==350 && KV==15)
            {
                real=.039;
                imag=.033;
            }
            else if (x==400 && KV==15)
            {
                real=.034;
                imag=.032;
            }
            else if (x==500 && KV==15)
            {
                real=.027;
                imag=.031;
            }
            else if (x==600 && KV==15)
            {
                real =.023;
                imag=.031;
            }
            else if (x==700 && KV==15)
            {
                real=.020;
                imag=.030;
            }
            else if (x==800 && KV==15)
            {
                real=.017;
                imag=.030;
            }
            else if (x==900 && KV==15)
            {
                real=.016;
                imag=.029;
            }
            else if (x==1000 && KV==15)
            {
                real=.014;
                imag=.029;
            }
            //End of Mine Power Feeder Cables 15KV.
            //Begining Mine POwer Feeder Cables 25KV.

            else if (x==1 && KV==25)
            {
                real=.160;
                imag=.044;
            }
            else if (x==10 && KV==25)
            {
                real=.127;
                imag=.043;
            }
            else if (x==20 && KV==25)
            {
                real=.101;
                imag=.042;
            }
            else if (x==30 && KV==25)
            {
                real=.080;
                imag=.040;
            }
            else if (x==40 && KV==25)
            {
                real=.063;
                imag=.039;
            }
            else if (x==250 && KV==25)
            {
                real = .054;
                imag= .038;
            }
            else if (x==300 && KV==25)
            {
                real=.045;
                imag=.037;
            }
            else if (x==350 && KV==25)
            {
                real=.039;
                imag=.036;
            }
            else if (x==400 && KV==25)
            {
                real=.034;
                imag=.035;
            }
            else if (x==500 && KV==25)
            {
                real=.027;
                imag=.034;
            }
            else if (x==600 && KV==25)
            {
                real =.023;
                imag=.033;
            }
            else if (x==700 && KV==25)
            {
                real=.020;
                imag=.032;
            }
            else if (x==800 && KV==25)
            {
                real=.017;
                imag=.031;
            }
            else if (x==900 && KV==25)
            {
                real=.016;
                imag=.031;
            }
           //End of All Cable Table Lookups.
        }
        //Accounting for Distance.
        real=real*Distance/1000;
        imag=imag*Distance/1000;


        Complex result =new Complex(real,imag);
        return result;
    }
    public static double max_resistance(double resistance_initial)//Accounts for Resistance@MaxTemp
    {   double result=resistance_initial+resistance_initial*((.00394)*(90-20));
        return result; //FOILED out cable temperature equation. R1=R0(1+Coefficient(Tn-Tr))
    }
    public static int Ampacity(int WireSize,int shielded,int KV,int Type)//Using ICEA Table.(40C) Base.
    {
        int result=0;
        if (Type==0 && (KV==2 || KV ==5))//Portable Power Cables
        {
            if (shielded == 0) { //No Need to test for insulation due to nonshielded.
                if (WireSize == 8)
                    result = 59;
                else if (WireSize == 6)
                    result = 79;
                else if (WireSize == 4)
                    result = 104;
                else if (WireSize == 3)
                    result = 120;
                else if (WireSize == 2)
                    result = 138;
                else if (WireSize == 1)
                    result = 161;
                else if (WireSize == 10)
                    result = 186;
                else if (WireSize == 20)
                    result = 215;
                else if (WireSize == 30)
                    result = 249;
                else if (WireSize == 40)
                    result = 287;
                else if (WireSize == 250)
                    result = 320;
                else if (WireSize == 300)
                    result = 357;
                else if (WireSize == 350)
                    result = 394;
                else if (WireSize == 400)
                    result = 430;
                else if (WireSize == 450)
                    result = 460;
                else if (WireSize == 500)
                    result = 487;
            }
            if (shielded == 1 && (KV == 2 || KV == 5 || KV == 8)) //Shielded 0-8000KV.
            {
                if (WireSize == 6)
                    result = 93;
                else if (WireSize == 4)
                    result = 122;
                else if (WireSize == 3)
                    result = 140;
                else if (WireSize == 2)
                    result = 159;
                else if (WireSize == 1)
                    result = 184;
                else if (WireSize == 10)
                    result = 211;
                else if (WireSize == 20)
                    result = 243;
                else if (WireSize == 30)
                    result = 279;
                else if (WireSize == 40)
                    result = 321;
                else if (WireSize == 250)
                    result = 355;
                else if (WireSize == 300)
                    result = 398;
                else if (WireSize == 350)
                    result = 435;
                else if (WireSize == 400)
                    result = 470;
                else if (WireSize == 450)
                    result = 503;
                else if (WireSize == 500)
                    result = 536;
            }
            if (shielded==1 && (KV==8 || KV==15))
            {
                if (WireSize==2)
                    result=164;
                else if (WireSize==1)
                    result=187;
                else if (WireSize==10)
                    result=215;
                else if (WireSize==20)
                    result=246;
                else if (WireSize==30)
                    result=283;
                else if (WireSize==40)
                    result=325;
                else if (WireSize==250)
                    result=359;
            }
            if (shielded==1 && KV==25)
            {
                if (WireSize==2)
                    result=178;
                else if (WireSize==1)
                    result=191;
                else if (WireSize==10)
                    result=218;
                else if (WireSize==20)
                    result=249;
                else if (WireSize==30)
                    result=286;
                else if (WireSize==40)
                    result=327;
                else if (WireSize==250)
                    result=360;
            }
        }
        if (Type==1)//Mine Power Feeder Cables
        {
            if (KV==5 || KV ==8)
            {
                if (WireSize==6)
                    result=93;
                else if (WireSize==4)
                    result=122;
                else if (WireSize==2)
                    result=159;
                else if (WireSize==1)
                    result=184;
                else if (WireSize==10)
                    result=211;
                else if (WireSize==20)
                    result=243;
                else if (WireSize==30)
                    result=279;
                else if (WireSize==40)
                    result=321;
                else if (WireSize==250)
                    result=355;
                else if (WireSize==300)
                    result=398;
                else if (WireSize==350)
                    result=435;
                else if (WireSize==400)
                    result=470;
                else if (WireSize==500)
                    result=536;

            }
            if (KV==15)
            {
                if (WireSize==4)
                    result=125;
                else if (WireSize==2)
                    result=164;
                else if (WireSize==1)
                    result=187;
                else if (WireSize==10)
                    result=215;
                else if (WireSize==20)
                    result=246;
                else if (WireSize==30)
                    result=283;
                else if (WireSize==40)
                    result=325;
                else if (WireSize==250)
                    result=359;
                else if (WireSize==300)
                    result=401;
                else if (WireSize==350)
                    result=438;
                else if (WireSize==400)
                    result=473;
                else if (WireSize==500)
                    result=536;
            }
            if (KV==25)
            {
                if (WireSize==1)
                    result=189;
                else if (WireSize==10)
                    result=216;
                else if (WireSize==20)
                    result=247;
                else if (WireSize==30)
                    result=284;
                else if (WireSize==40)
                    result= 325;
                else if (WireSize==250)
                    result=359;
                else if (WireSize==300)
                    result=401;
                else if (WireSize==350)
                    result=438;
                else if (WireSize==400)
                    result=473;
                else if (WireSize==500)
                    result=536;
            }
        }
        //Now correcting our results to reflect a 20C ambient.
        double temp1=result*1.18;
        result=(int)temp1;
        return result;
    }
    public static int AmpacityCorrection30(double Ampacity)
    {
        double result=0.93*Ampacity;

        return (int)result;
    }
    public static double ShortCircuitInsulation(int Wiresize)
    {
        //Must Use BigDecimal due to the Rounding Error.
        double result=0;
        //Really Hate Declaring everything this way but Memory is cheap.
        BigDecimal temp=new BigDecimal(0.00517672043770266986991256338512794122440280104785264507724);
        BigDecimal Cycles = new BigDecimal(4); //Four Cycles
        BigDecimal Frequency = new BigDecimal(60); //Defining the Base Frequency.
        BigDecimal MCM=new BigDecimal(Math.round(AWGtoCmil(Wiresize))); //Getting OUR Cmils
        Cycles=Cycles.divide(Frequency,MathContext.DECIMAL128); //Here we Obtain (3/60)
        temp=temp.divide(Cycles,MathContext.DECIMAL128); //Dividing .00517../(4/60)
        temp= temp.multiply(MCM.multiply(MCM)); //Multiplying our MCM for for our equation.
        result=Math.sqrt(temp.doubleValue());
        return result;
    }
    public static long AWGtoCmil(int WireSize)
    {
        long result=0;
        if (WireSize==8)
            result=16510;
        else if (WireSize==7)
            result=20820;
        else if (WireSize==6)
            result=26240;
        else if (WireSize==5)
            result=33090;
        else if (WireSize==4)
            result=41740;
        else if (WireSize==3)
            result = 52620;
        else if (WireSize==2)
            result=66360;
        else if (WireSize==1)
            result=83690;
        else if (WireSize==10)
            result=105600;
        else if (WireSize==20)
            result=133100;
        else if (WireSize==30)
            result=167800;
        else if (WireSize==40)
            result=211600;
        else if (WireSize==250)
            result=250000;
        else if (WireSize==300)
            result=300000;
        else if (WireSize==350)
            result=350000;
        else if (WireSize==500)
            result=500000;

        return result;
    }
}
