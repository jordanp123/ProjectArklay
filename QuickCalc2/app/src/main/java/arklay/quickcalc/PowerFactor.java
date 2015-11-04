package arklay.quickcalc;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import java.math.BigDecimal;
import java.math.MathContext;

public class PowerFactor extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_power_factor);
    }

    public double format(EditText input)//takes input of EditText from Textbox and converts to float.
    {
        double result = 0;
        String Box4str = input.getText().toString();
        if (Box4str != null && !Box4str.isEmpty()) {
            result = Float.parseFloat(Box4str);
        }
        return result;
    }

    public void Displace(View V)  // A Lot of grief went in right here, forgot the View input.
    {

        EditText KVAInput = (EditText)findViewById(R.id.KVA_input);
        EditText Current_PowerFactor = (EditText)findViewById(R.id.Current_PF);
        EditText Desired_PowerFactor = (EditText)findViewById(R.id.Desired_PF);
        EditText VLL = (EditText)findViewById(R.id.VLL);
        //All of our User Input References have been declared.

        TextView KVAR_Needed = (TextView)findViewById(R.id.KVAR_Result);
        TextView Current_Differential=(TextView)findViewById(R.id.Current_Differential);
        TextView ShowWyeCapacitance=(TextView)findViewById(R.id.Capcitance_Wye);
        TextView ShowDeltaCapacitance=(TextView)findViewById(R.id.Capcitance_Delta);
        TextView ShowEnergy=(TextView)findViewById(R.id.Capacitor_Energy);


        double KVA_Input_Double=format(KVAInput);
        double Current_PowerFactor_Double=format(Current_PowerFactor);
        double Desired_PowerFactor_Double=format(Desired_PowerFactor);
        double VLL_Double=format(VLL);
        //We have now converted all of our user input's into usuable double variables.

        if (Current_PowerFactor_Double>1 || Current_PowerFactor_Double<=0)
        {
            Current_PowerFactor_Double=1; //Accounting for Novice use of PF.
            Toast.makeText(PowerFactor.this, "Invalid Current Power Factor", Toast.LENGTH_LONG).show();
        }
        if (Desired_PowerFactor_Double>1 || Desired_PowerFactor_Double<=0)
        {
            Desired_PowerFactor_Double=1; //Accounting for Novice use of PF.
            Toast.makeText(PowerFactor.this, "Invalid Desired Power Factor", Toast.LENGTH_LONG).show();
        }
        if (VLL_Double<=0)
        {
            VLL_Double=12470; //Accounting for Invalid Input.
            Toast.makeText(PowerFactor.this, "Invalid Input Voltage", Toast.LENGTH_LONG).show();
        }
        double VARS=KVA_Input_Double*Math.sin(Math.acos(Current_PowerFactor_Double));
        double DesiredVARS=KVA_Input_Double*Math.sin(Math.acos(Desired_PowerFactor_Double));
        double VARSDifferential=VARS-DesiredVARS;
        double PreCorrection_Current=1000*(KVA_Input_Double/(Math.sqrt(3)*VLL_Double));//1000*KVA/(1.732*VLL)
        double PostCorrection_Current=(((1000*KVA_Input_Double*Current_PowerFactor_Double)/Desired_PowerFactor_Double)/(Math.sqrt(3)*VLL_Double));
        Current_Differential.setText(String.format("%.2f",(PreCorrection_Current-PostCorrection_Current)));
        KVAR_Needed.setText(String.format("%.2f",VARSDifferential));
        //Most of the calculations are now complete, we now simply need to calculate the Capacitance values.


        BigDecimal VARSNeeded=new BigDecimal(VARSDifferential); //Our Variable X, No Angle Calculated DIfference of VARS KVA
        BigDecimal ThreePhaseCorrection=new BigDecimal(3); //We need that as we are calculating per phase.
        BigDecimal MicroFarads=new BigDecimal(1000000); //1*10^6
        BigDecimal KVAtoVA=new BigDecimal(1000);
        VARSNeeded=VARSNeeded.multiply(KVAtoVA); //Converting our KVA to VA
        VARSNeeded=VARSNeeded.divide(ThreePhaseCorrection,MathContext.DECIMAL128);
        VARSNeeded=VARSNeeded.multiply(MicroFarads);
        BigDecimal Omega=new BigDecimal(2*Math.PI*60); //Omega.
        BigDecimal VLN = new BigDecimal(VLL_Double/Math.sqrt(3));
        BigDecimal VLLine = new BigDecimal (VLL_Double);
        BigDecimal Denominator_Wye;
        BigDecimal Denominator_Delta;
        Denominator_Wye=Omega.multiply(VLN.multiply(VLN));//Wye Capacitance Calculation V*V
        Denominator_Delta=Omega.multiply(VLLine.multiply(VLLine));
        double Capacitance_Wye=VARSNeeded.divide(Denominator_Wye, MathContext.DECIMAL128).doubleValue();
        double Capacitance_Delta=VARSNeeded.divide(Denominator_Delta,MathContext.DECIMAL128).doubleValue();


        //Calculating Capacitor Energy Below.
        BigDecimal Energy = new BigDecimal(0.5*Capacitance_Delta); //0.5*C
        BigDecimal Million =new BigDecimal(1000000);
        Energy=Energy.multiply(VLLine.multiply(VLLine)); //V^2 or in the last two lines, 1/2 CV^2
        Energy=Energy.divide(Million,MathContext.DECIMAL128); //Convert to MJoules.
        double Energy_double=Energy.doubleValue();
        //Done Calculating Capacitor Energy.
        ShowWyeCapacitance.setText(String.format("%.8f",Capacitance_Wye));
        ShowDeltaCapacitance.setText(String.format("%.8f",Capacitance_Delta));
        ShowEnergy.setText(String.format("%.2f",Energy_double)); // (1/2)CV^2





    }


}
