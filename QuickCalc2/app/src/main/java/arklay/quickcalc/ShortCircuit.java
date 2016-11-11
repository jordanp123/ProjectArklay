package arklay.quickcalc;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

public class ShortCircuit extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_short_circuit);
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
    public void CalculateSC(View V)
    {
        //Utility Fields
        EditText Base = (EditText)findViewById(R.id.UtilityKVASC);
        EditText UV =(EditText)findViewById(R.id.UtilityVLL);
        EditText XR=(EditText)findViewById(R.id.UtilityX1_R1);

        //Utility Variables.
        double UtilityX1_R1=format(XR);
        int UtilityVLL=(int)format(UV);
        int  KVAbase=(int)format(Base);  //Utility KVA.

        //Mine Substation Fields
        EditText Sub1VLLField=(EditText)findViewById(R.id.Sub1VLL);
        EditText Sub1KVAField=(EditText)findViewById(R.id.Sub1KVA);
        EditText Sub1XRField=(EditText)findViewById(R.id.Sub1X1_R1);
        EditText Sub1ZField=(EditText)findViewById(R.id.Sub1ZPercent);

        //Mine Substation Variables
        int Sub1VLL=(int)format(Sub1VLLField);
        int Sub1KVA=(int)format(Sub1KVAField);
        double Sub1XR=format(Sub1XRField);
        double Sub1Z=format(Sub1ZField);

        //Feeder Cable Fields
        EditText FeederResistanceField=(EditText)findViewById(R.id.Feeder1Resistance);
        EditText FeederReactanceField=(EditText)findViewById(R.id.Feeder1Reactance);

        //Feeder Variables.
        double FeederResistance=format(FeederResistanceField);
        double FeederReactance=format(FeederReactanceField);
        double FeederResistance90=CableValues.max_resistance(FeederResistance);
        //Mine Substation 2

        EditText Sub2VLLField=(EditText)findViewById(R.id.Sub2VLL);
        EditText Sub2KVA=(EditText)findViewById(R.id.Sub2KVA);
        EditText Sub2XRField=(EditText)findViewById(R.id.Sub2X1_R1);
        EditText Sub2ZField=(EditText)findViewById(R.id.Sub2ZPercent);

        //Mine Substation 2 Variables.
        int Sub2VLL=(int)format(Sub2VLLField);
        int Sub2KVAA=(int)format(Sub2KVA);
        double Sub2XR=format(Sub2XRField);
        double Sub2Z=format(Sub2ZField);

        //Mine Cable.

        EditText MineCableResistanceField=(EditText)findViewById(R.id.MineCableResistance);
        EditText MineCableReactanceField=(EditText)findViewById(R.id.MineCableReactance);

        //Mine Cable Variables.

        double MineCableResistance=format(MineCableResistanceField);
        double MineCableReactace=format(MineCableReactanceField);
        double MineCableResistance90=CableValues.max_resistance(MineCableResistance);

        //All links for Input have now been completed.
       //Need to

        //Utility Calculation Below
        double Utility_Zbase=(UtilityVLL*UtilityVLL/(KVAbase*1000))/(UtilityVLL*UtilityVLL/(PerUnit.VA_Base)); //Because of System Input Layout.
        double Utility_Zangle=Math.atan(UtilityX1_R1); //Our Impedance Angle (Positive Sequence).
        Complex Utility_Zpercent= new Complex((Utility_Zbase)*Math.cos(Utility_Zangle),(Utility_Zbase)*Math.sin(Utility_Zangle));  //This is one based on the way were specifying the system. i.e.  1(p.u. Voltage)/1 (p.u. Z) multipled by I_Base = I_Base or our Short Circuit I.


        //Mine Substation 1 Calculation Below
        double Sub1_Zangle=Math.atan(Sub1XR);
        Sub1Z=Sub1Z/100; //Converting our percentage back to a decimal.
        Complex Sub1_Zpercent_NotRebased = new Complex((Sub1Z*Math.cos(Sub1_Zangle)),Sub1Z*Math.sin(Sub1_Zangle));
        Complex Sub1_Zpercent= new Complex (PerUnit.ImpedanceRebase(Sub1VLL,Sub1VLL,Sub1KVA,Sub1_Zpercent_NotRebased).re(),PerUnit.ImpedanceRebase(Sub1VLL,Sub1VLL,Sub1KVA,Sub1_Zpercent_NotRebased).im());
        double Sub1_Ibase=PerUnit.VA_Base/(Sub1VLL*Math.sqrt(3));

        //Mine Feeder Cable Calculation below. Note that a Call to CableValues is done earlier to account for Cable Heating.
        FeederResistance=FeederResistance/(Sub1VLL*Sub1VLL/PerUnit.VA_Base);  //Value Divided by Zbase.
        FeederResistance90=FeederResistance90/(Sub1VLL*Sub1VLL/PerUnit.VA_Base); //Same as above except cable heating accounted for.
        FeederReactance=FeederReactance/(Sub1VLL*Sub1VLL/PerUnit.VA_Base);
        Complex FeederImpedance=new Complex(FeederResistance,FeederReactance);
        Complex FeederMaxImpedance=new Complex(FeederResistance90,FeederReactance);

        //Mine SUbstation 2 Calculation Below.
        double Sub2Zangle=Math.atan(Sub2XR);
        Sub2Z=Sub2Z/100; //Comverting our % back to a decimal.
        double temp_real=Sub2Z*Math.cos(Sub2Zangle);
        double temp_imag=Sub2Z*Math.sin(Sub2Zangle);
        Complex Sub2Z_NotRebased=new Complex(temp_real,temp_imag);
        Complex Sub2ZRebased= new Complex (PerUnit.ImpedanceRebase(Sub2VLL,Sub2VLL,Sub2KVAA,Sub2Z_NotRebased).re(),PerUnit.ImpedanceRebase(Sub2VLL,Sub2VLL,Sub2KVAA,Sub2Z_NotRebased).im());
        double Sub2_Ibase=PerUnit.VA_Base/(Math.sqrt(3)*Sub2VLL);

        //Mine Cable Calculation Below.
        MineCableResistance=MineCableResistance/((Sub2VLL*Sub2VLL)/PerUnit.VA_Base);
        MineCableResistance90=MineCableResistance90/((Sub2VLL*Sub2VLL)/PerUnit.VA_Base);
        MineCableReactace=MineCableReactace/((Sub2VLL*Sub2VLL)/PerUnit.VA_Base);
        Complex MineCableImpedance= new Complex(MineCableResistance,MineCableReactace);
        Complex MineCableImpedanceMax = new Complex(MineCableResistance90,MineCableReactace);

        //Calculate SC Here.

        //Mine Substation SC Below
        Complex Sub1TotalImpedance=Complex.plus(Sub1_Zpercent,Utility_Zpercent);
        double Sub1MaxAmps=Sub1_Ibase*(1/(Sub1TotalImpedance.abs()));
        double Sub1MinAmps=(Math.sqrt(3)*0.95/2)*Sub1MaxAmps; //Note here we did not need to take into account cable heating. As there is no cable.

        //Mine Feeder Cable SC Below.
        Complex MineFeederTotalImpedance=Complex.plus(Sub1TotalImpedance,FeederImpedance);
        Complex MineFeederMaxTotalImpedance=Complex.plus(Sub1TotalImpedance,FeederMaxImpedance);
        double MineFeederMaxAmps=Sub1_Ibase*(1/(MineFeederTotalImpedance.abs()));
        double MineFeederMinAmps=(Math.sqrt(3)*0.95/2)*Sub1_Ibase*(1/MineFeederMaxTotalImpedance.abs());


        //MineSubstation 2 SC below.
        Complex MinSub2Impedance = Complex.plus(MineFeederTotalImpedance,Sub2ZRebased);
        Complex MaxSub2Impedance = Complex.plus(MineFeederMaxTotalImpedance,Sub2ZRebased);
        double Sub2MaxAmps=Sub2_Ibase*(1/(MinSub2Impedance.abs()));
        double Sub2MinAmps=Sub2_Ibase*(Math.sqrt(3)*0.95/2)*(1/(MaxSub2Impedance.abs()));

        //Mine Cable SC Below.
        Complex MineCableTotalImpedance = Complex.plus(MinSub2Impedance,MineCableImpedance);
        Complex MineCableMaxTotalImpedance = Complex.plus(MaxSub2Impedance,MineCableImpedanceMax);
        double MineCableMaxAmps = Sub2_Ibase*(1/(MineCableTotalImpedance.abs()));
        double MineCableMinAmps=Sub2_Ibase*(Math.sqrt(3)*0.95/2)*(1/MineCableMaxTotalImpedance.abs());

        //Displaying our Results Below.

        TextView Sub1MaxAmpsField=(TextView)findViewById(R.id.Sub1MaxAmps);
        Sub1MaxAmpsField.setText(String.format("%.2f",Sub1MaxAmps));
        TextView Sub1MinAmpsField=(TextView)findViewById(R.id.Sub1MinAmps);
        Sub1MinAmpsField.setText(String.format("%.2f",Sub1MinAmps));

        TextView Feeder1MaxAmpsField=(TextView)findViewById(R.id.Feeder1MaxAmps);
        Feeder1MaxAmpsField.setText(String.format("%.2f",MineFeederMaxAmps));
        TextView Feeder1MinAmpsField=(TextView)findViewById(R.id.Feeder1MinAmps);
        Feeder1MinAmpsField.setText(String.format("%.2f",MineFeederMinAmps));

        TextView Sub2MaxAmpsField=(TextView)findViewById(R.id.Sub2MaxAmps);
        Sub2MaxAmpsField.setText(String.format("%.2f",Sub2MaxAmps));
        TextView Sub2MinAmpsField=(TextView)findViewById(R.id.Sub2MinAmps);
        Sub2MinAmpsField.setText(String.format("%.2f",Sub2MinAmps));

        TextView MineCableMaxAmpsField = (TextView)findViewById(R.id.MineCableMaxAmps);
        MineCableMaxAmpsField.setText(String.format("%.2f",MineCableMaxAmps));
        TextView MineCableMinAmpsField = (TextView)findViewById(R.id.MineCableMinAmps);
        MineCableMinAmpsField.setText(String.format("%.2f",MineCableMinAmps));

    }



    
}
