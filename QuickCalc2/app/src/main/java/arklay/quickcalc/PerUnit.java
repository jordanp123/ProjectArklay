package arklay.quickcalc;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.widget.EditText;

public class PerUnit extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_per_unit);
    }

    public static final double KVA_Base=1000*100; // 100KVA is our Base Power, Doesn't change in any calculation.


    public double format(EditText input)//takes input of EditText from Textbox and converts to float.
    {
        double result = 0;
        String Box4str = input.getText().toString();
        if (Box4str != null && !Box4str.isEmpty()) {
            result = Float.parseFloat(Box4str);
        }
        return result;
    }

    public static Complex ImpedanceRebase(double VLL_Old,double VLL_New,double KVA_Old,Complex oldZ)
    {
        double KVA_new=KVA_Base;
        KVA_Old=KVA_Old*1000; //Convert Back to VA
        double newBase=(KVA_new/(VLL_New*VLL_New)); //Our new Base Impedance;
        double Actual_Real=oldZ.re()*(KVA_Old/(VLL_Old*VLL_Old));
        double Actual_Imag=oldZ.im()*(KVA_Old/(VLL_Old*VLL_Old));
        Actual_Real=Actual_Real/newBase;
        Actual_Imag=Actual_Imag/newBase;
        Complex result = new Complex(Actual_Real,Actual_Imag);
        return result;
    }
    public static Complex CurrentRebase(double VLL_Old,double VLL_New,double KVA_Old,Complex oldI)
    {
        double KVA_new=KVA_Base;
        KVA_Old=KVA_Old*1000; //Convert Back to VA
        double newBase=(KVA_new/(VLL_New*Math.sqrt(3))); //Our new Base Current;
        double Actual_Real=oldI.re()*(KVA_Old/(VLL_Old*Math.sqrt(3)));
        double Actual_Imag=oldI.im()*(KVA_Old/(VLL_Old*Math.sqrt(3)));
        Actual_Real=Actual_Real/newBase;
        Actual_Imag=Actual_Imag/newBase;
        Complex result = new Complex(Actual_Real,Actual_Imag);
        return result;
    }
    public static double Ibase(double VLL) // As this is our Base, Base Current is NEVER complex.
    {
        double Ibase=KVA_Base/(VLL*Math.sqrt(3));
        return Ibase;
    }
    public static double Zbase(double VLL) //As this is our Base, Base Impedance is NEVER complex.
    {;
        double Zbase=(VLL*VLL/KVA_Base);
        return Zbase;
    }
}
